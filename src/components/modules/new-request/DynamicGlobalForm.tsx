import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import type { ServiceFormField } from "@/src/types/catalog";
import { TABASCO_MUNICIPALITIES } from "@/src/constants/tabasco";
import { Pressable, View } from "react-native";
import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { filesService } from "@/src/services/files";
import { Button } from "@/src/components/ui/button";

type Props = {
  fields: ServiceFormField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  title?: string;
  description?: string;
};

const selectedValues = (value?: string) =>
  value
    ? value
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const isMunicipalityField = (field: ServiceFormField) => {
  const identity = `${field.key} ${field.label}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return identity.includes("municipio");
};

export function DynamicGlobalForm({
  fields,
  values,
  onChange,
  title = "Datos generales",
  description = "Esta información se solicita para todos los trámites.",
}: Props) {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const setValue = (key: string, value: string) =>
    onChange({ ...values, [key]: value });
  const uploadPickedFile = async (
    field: ServiceFormField,
    file: File | { uri: string; name: string; type: string },
  ) => {
    setUploadingKey(field.key);
    try {
      const uploaded = await filesService.uploadImage(file, "request_documents");
      setValue(field.key, JSON.stringify({ fileId: uploaded.filename, name: uploaded.originalname, type: uploaded.mimetype, size: uploaded.size, url: uploaded.url }));
    } catch (cause) {
      setUploadErrors((current) => ({ ...current, [field.key]: cause instanceof Error ? cause.message : "No fue posible subir el archivo" }));
    } finally {
      setUploadingKey(null);
    }
  };
  const pickDocument = async (field: ServiceFormField) => {
    setUploadErrors((current) => ({ ...current, [field.key]: "" }));
    const fileTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

    const result = await DocumentPicker.getDocumentAsync({
      type: fileTypes,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadPickedFile(
      field,
      asset.file || { uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream" },
    );
  };
  const pickImage = async (field: ServiceFormField) => {
    setUploadErrors((current) => ({ ...current, [field.key]: "" }));
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploadErrors((current) => ({ ...current, [field.key]: "Permite el acceso a Fotos para seleccionar una imagen." }));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadPickedFile(
      field,
      asset.file || {
        uri: asset.uri,
        name: asset.fileName || `imagen-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      },
    );
  };

  return (
    <View className="gap-5 rounded-2xl border border-border bg-card p-5">
      <View>
        <Text className="text-xl font-bold">{title}</Text>
        <Text className="mt-1 text-muted-foreground">{description}</Text>
      </View>
      {fields.map((field) => {
        const value = values[field.key] || "";
        const options =
          field.options?.length || !isMunicipalityField(field)
            ? field.options || []
            : [...TABASCO_MUNICIPALITIES];
        const selected = selectedValues(value);
        const isChoice =
          field.type === "select" || field.type === "multiselect";

        return (
          <View key={field.key} className="gap-2">
            <Text className="font-medium">
              {field.label}
              {field.required === false ? (
                <Text className="text-muted-foreground"> (opcional)</Text>
              ) : (
                " *"
              )}
            </Text>

            {field.type === "file" ? (
              <View className="gap-2 rounded-xl border border-dashed border-border p-4">
                <View className="flex-row flex-wrap gap-2">
                  {field.fileType !== "document" ? (
                    <Button className="min-w-44 flex-1" variant="outline" disabled={uploadingKey === field.key} onPress={() => pickImage(field)}>
                      <Text>{uploadingKey === field.key ? "Subiendo..." : value ? "Cambiar por una imagen" : "Elegir de Fotos"}</Text>
                    </Button>
                  ) : null}
                  {field.fileType !== "image" ? (
                    <Button className="min-w-44 flex-1" variant="outline" disabled={uploadingKey === field.key} onPress={() => pickDocument(field)}>
                      <Text>{uploadingKey === field.key ? "Subiendo..." : value ? "Cambiar por un documento" : "Elegir documento"}</Text>
                    </Button>
                  ) : null}
                </View>
                {value ? (
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-sm text-primary" numberOfLines={1}>
                      {(() => { try { return JSON.parse(value).name; } catch { return "Archivo adjunto"; } })()}
                    </Text>
                    <Pressable onPress={() => setValue(field.key, "")}><Text className="text-sm text-destructive">Quitar</Text></Pressable>
                  </View>
                ) : null}
                {uploadErrors[field.key] ? <Text className="text-sm text-destructive">{uploadErrors[field.key]}</Text> : null}
                <Text className="text-xs text-muted-foreground">
                  {field.fileType === "document" ? "PDF, Word o Excel. Máximo 15 MB." : field.fileType === "image" ? "Imágenes (JPG, PNG). Máximo 15 MB." : "PDF, imagen, Word o Excel. Máximo 15 MB."}
                </Text>
              </View>
            ) : isChoice ? (
              <View className="flex-row flex-wrap gap-2">
                {options.map((option) => {
                  const active = selected.includes(option);
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        if (field.type === "select") {
                          setValue(field.key, option);
                          return;
                        }
                        const next = active
                          ? selected.filter((item) => item !== option)
                          : [...selected, option];
                        setValue(field.key, next.join("|"));
                      }}
                      className={`rounded-xl border px-4 py-3 ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background"
                      }`}
                    >
                      <Text
                        className={active ? "font-semibold text-primary" : ""}
                      >
                        {field.type === "multiselect"
                          ? `${active ? "✓ " : ""}${option}`
                          : option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : field.type === "boolean" ? (
              <View className="flex-row gap-2">
                {["Sí", "No"].map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setValue(field.key, option)}
                    className={`min-w-24 rounded-xl border px-4 py-3 ${
                      value === option
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background"
                    }`}
                  >
                    <Text
                      className={`text-center ${value === option ? "font-semibold text-primary" : ""}`}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Input
                value={value}
                onChangeText={(next) => setValue(field.key, next)}
                placeholder={
                  field.placeholder ||
                  (field.type === "date" ? "AAAA-MM-DD" : undefined)
                }
                keyboardType={
                  field.type === "email"
                    ? "email-address"
                    : field.type === "tel" || field.type === "number"
                      ? "numeric"
                      : "default"
                }
                autoCapitalize={field.type === "email" ? "none" : "sentences"}
                multiline={field.type === "textarea"}
                className={field.type === "textarea" ? "min-h-28" : ""}
              />
            )}
            {field.placeholder && isChoice ? (
              <Text className="text-xs text-muted-foreground">
                {field.placeholder}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export const isDynamicFormComplete = (
  fields: ServiceFormField[],
  values: Record<string, string>,
) =>
  fields
    .filter((field) => field.required !== false)
    .every((field) => Boolean(values[field.key]?.trim()));
