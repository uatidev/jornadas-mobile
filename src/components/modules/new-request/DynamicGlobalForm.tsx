import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import type { ServiceFormField } from "@/src/types/catalog";
import { TABASCO_MUNICIPALITIES } from "@/src/constants/tabasco";
import { Linking, Platform, Pressable, View } from "react-native";
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

type UploadedDocument = { fileId: string; name: string; type: string; size?: number; url?: string };
const uploadedDocuments = (value?: string): UploadedDocument[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return (Array.isArray(parsed) ? parsed : [parsed]).filter((item) => item?.fileId);
  } catch { return []; }
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
    file: File | { uri: string; name: string; type: string; size?: number },
    append = false,
  ) => {
    setUploadingKey(field.key);
    try {
      const uploaded = await filesService.uploadImage(file, "request_documents");
      const document = { fileId: uploaded.filename, name: uploaded.originalname, type: uploaded.mimetype, size: uploaded.size, url: uploaded.url };
      const current = uploadedDocuments(values[field.key]);
      setValue(field.key, JSON.stringify(append ? [...current, document] : document));
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
      multiple: true,
    });
    if (result.canceled || !result.assets.length) return;
    const current = uploadedDocuments(values[field.key]);
    const available = Math.max(0, 5 - current.length);
    const assets = result.assets.slice(0, available);
    if (!assets.length) {
      setUploadErrors((errors) => ({ ...errors, [field.key]: "Puedes adjuntar hasta 5 archivos." }));
      return;
    }
    setUploadingKey(field.key);
    try {
      const uploaded = await filesService.uploadMultipleImages(
        assets.map((asset) => asset.file || { uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream", size: asset.size }),
        "request_documents",
      );
      const documents = uploaded.map((item) => ({ fileId: item.filename, name: item.originalname, type: item.mimetype, size: item.size, url: item.url }));
      setValue(field.key, JSON.stringify([...current, ...documents]));
      if (result.assets.length > available) {
        setUploadErrors((errors) => ({ ...errors, [field.key]: "Sólo se agregaron archivos hasta completar el límite de 5." }));
      }
    } catch (cause) {
      setUploadErrors((errors) => ({ ...errors, [field.key]: cause instanceof Error ? cause.message : "No fue posible subir los archivos" }));
    } finally {
      setUploadingKey(null);
    }
  };
  const pickImage = async (field: ServiceFormField) => {
    setUploadErrors((current) => ({ ...current, [field.key]: "" }));
    try {
      const result =
        Platform.OS === "web"
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: false,
              quality: 0.9,
              allowsMultipleSelection: false,
            })
          : await (async () => {
              const permission =
                await ImagePicker.requestCameraPermissionsAsync();
              if (!permission.granted) {
                setUploadErrors((current) => ({
                  ...current,
                  [field.key]:
                    "Se necesita permiso para usar la cámara. Habilítalo en la configuración del teléfono.",
                }));
                if (!permission.canAskAgain) {
                  await Linking.openSettings();
                }
                return null;
              }
              return ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.85,
              });
            })();

      if (!result || result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      await uploadPickedFile(
        field,
        asset.file || {
          uri: asset.uri,
          name: asset.fileName || `imagen-${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
          size: asset.fileSize,
        },
        true,
      );
    } catch (cause) {
      setUploadErrors((current) => ({
        ...current,
        [field.key]:
          cause instanceof Error
            ? cause.message
            : "No fue posible abrir la cámara.",
      }));
    }
  };

  return (
    <View className="gap-5 rounded-2xl border border-border bg-card p-5">
      <View>
        <Text className="text-xl font-bold">{title}</Text>
        <Text className="mt-1 text-muted-foreground">{description}</Text>
      </View>
      {fields.map((field) => {
        const value = values[field.key] || "";
        const attachedDocuments = uploadedDocuments(value);
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
                    <Button className="min-w-44 flex-1" variant="outline" disabled={uploadingKey === field.key || attachedDocuments.length >= 5} onPress={() => pickImage(field)}>
                      <Text>
                        {uploadingKey === field.key
                          ? "Subiendo..."
                          : Platform.OS === "web"
                            ? attachedDocuments.length
                              ? "Agregar otra imagen"
                              : "Elegir imagen"
                            : attachedDocuments.length
                              ? "Tomar otra foto"
                              : "Tomar foto"}
                      </Text>
                    </Button>
                  ) : null}
                  {field.fileType !== "image" ? (
                    <Button className="min-w-44 flex-1" variant="outline" disabled={uploadingKey === field.key || attachedDocuments.length >= 5} onPress={() => pickDocument(field)}>
                      <Text>{uploadingKey === field.key ? "Subiendo..." : attachedDocuments.length ? "Agregar documentos" : "Elegir documentos"}</Text>
                    </Button>
                  ) : null}
                </View>
                {attachedDocuments.map((document, index) => (
                  <View key={document.fileId} className="flex-row items-center justify-between gap-3 rounded-lg bg-muted/50 p-2">
                    <Text className="flex-1 text-sm text-primary" numberOfLines={1}>{index + 1}. {document.name}</Text>
                    <Pressable onPress={() => {
                      const remaining = attachedDocuments.filter((item) => item.fileId !== document.fileId);
                      setValue(field.key, remaining.length ? JSON.stringify(remaining) : "");
                    }}><Text className="text-sm text-destructive">Quitar</Text></Pressable>
                  </View>
                ))}
                {uploadErrors[field.key] ? <Text className="text-sm text-destructive">{uploadErrors[field.key]}</Text> : null}
                <Text className="text-xs text-muted-foreground">
                  {field.fileType === "document" ? `Hasta 5 archivos (${attachedDocuments.length}/5). PDF, Word o Excel; máximo 15 MB por archivo.` : `Hasta 5 fotografías (${attachedDocuments.length}/5). Máximo 15 MB por imagen.`}
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
