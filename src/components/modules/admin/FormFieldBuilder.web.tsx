import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import type { ServiceFormField } from "@/src/types/catalog";
import { Pressable, Switch, View } from "react-native";

const FIELD_TYPES: { value: ServiceFormField["type"]; label: string }[] = [
  { value: "text", label: "Texto corto" },
  { value: "textarea", label: "Texto largo" },
  { value: "number", label: "Número" },
  { value: "email", label: "Correo electrónico" },
  { value: "tel", label: "Teléfono" },
  { value: "date", label: "Fecha" },
  { value: "select", label: "Selección única" },
  { value: "multiselect", label: "Selección múltiple" },
  { value: "boolean", label: "Sí / No" },
  { value: "file", label: "Archivo o documento" },
];

export const isFormBuilderValid = (fields: ServiceFormField[]) =>
  fields.every(
    (field) =>
      field.key &&
      field.label.trim() &&
      (!(field.type === "select" || field.type === "multiselect") ||
        (!!field.options?.length &&
          field.options.every((option) => option.trim()) &&
          new Set(field.options.map((option) => option.trim().toLowerCase()))
            .size === field.options.length)),
  ) && new Set(fields.map((field) => field.key)).size === fields.length;

export function FormFieldBuilder({
  fields,
  onChange,
  emptyText = "Todavía no hay preguntas específicas.",
}: {
  fields: ServiceFormField[];
  onChange: (fields: ServiceFormField[]) => void;
  emptyText?: string;
}) {
  const update = (index: number, changes: Partial<ServiceFormField>) =>
    onChange(
      fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...changes } : field,
      ),
    );
  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= fields.length) return;
    const next = [...fields];
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next);
  };

  return (
    <View className="gap-4">
      {!fields.length ? (
        <Text className="rounded-xl bg-muted p-4 text-muted-foreground">
          {emptyText}
        </Text>
      ) : null}
      {fields.map((field, index) => (
        <View
          key={field.key}
          className="gap-4 rounded-xl border border-border bg-background p-4"
        >
          <View className="flex-row items-center justify-between">
            <Text className="font-bold">Pregunta {index + 1}</Text>
            <View className="flex-row gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!index}
                onPress={() => move(index, -1)}
              >
                <Text>↑</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={index === fields.length - 1}
                onPress={() => move(index, 1)}
              >
                <Text>↓</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onPress={() =>
                  onChange(fields.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <Text>Eliminar</Text>
              </Button>
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-sm font-semibold">Pregunta</Text>
            <Input
              value={field.label}
              onChangeText={(label) => update(index, { label })}
              placeholder="Escribe la pregunta"
            />
          </View>
          <View className="grid grid-cols-2 gap-4">
            <View className="gap-2">
              <Text className="text-sm font-semibold">Tipo de respuesta</Text>
              <select
                value={field.type || "text"}
                onChange={(event) =>
                  update(index, {
                    type: event.currentTarget.value as ServiceFormField["type"],
                  })
                }
                style={{
                  minHeight: 40,
                  border: "1px solid #d4d4d8",
                  borderRadius: 8,
                  padding: "8px 12px",
                  background: "transparent",
                  color: "inherit",
                }}
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </View>
            <View className="gap-2">
              <Text className="text-sm font-semibold">Texto de ayuda</Text>
              <Input
                value={field.placeholder || ""}
                onChangeText={(placeholder) => update(index, { placeholder })}
                placeholder="Indicación para responder"
              />
            </View>
          </View>
          {field.type === "file" ? (
            <View className="gap-2 mt-4">
              <Text className="text-sm font-semibold">Tipos de archivo permitidos</Text>
              <select
                value={field.fileType || "any"}
                onChange={(event) =>
                  update(index, {
                    fileType: event.currentTarget.value as ServiceFormField["fileType"],
                  })
                }
                style={{
                  minHeight: 40,
                  border: "1px solid #d4d4d8",
                  borderRadius: 8,
                  padding: "8px 12px",
                  background: "transparent",
                  color: "inherit",
                }}
              >
                <option value="any">Documentos e imágenes</option>
                <option value="document">Solo documentos (PDF, Word, Excel)</option>
                <option value="image">Solo imágenes (JPG, PNG)</option>
              </select>
            </View>
          ) : null}
          {field.type === "select" || field.type === "multiselect" ? (
            <View className="gap-3">
              <Text className="text-sm font-semibold">
                Opciones de respuesta
              </Text>
              {(field.options || []).map((option, optionIndex) => (
                <View key={optionIndex} className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <Input
                      value={option}
                      onChangeText={(value) => {
                        const options = [...(field.options || [])];
                        options[optionIndex] = value;
                        update(index, { options });
                      }}
                      placeholder={`Opción ${optionIndex + 1}`}
                    />
                  </View>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      update(index, {
                        options: (field.options || []).filter(
                          (_, itemIndex) => itemIndex !== optionIndex,
                        ),
                      })
                    }
                  >
                    <Text>Quitar</Text>
                  </Button>
                </View>
              ))}
              <Button
                variant="outline"
                onPress={() =>
                  update(index, { options: [...(field.options || []), ""] })
                }
              >
                <Text>+ Agregar opción</Text>
              </Button>
            </View>
          ) : null}
          <Pressable
            className="flex-row items-center justify-between rounded-lg bg-muted p-3"
            onPress={() =>
              update(index, { required: field.required === false })
            }
          >
            <View>
              <Text className="font-semibold">Pregunta obligatoria</Text>
              <Text className="text-xs text-muted-foreground">
                Desactiva para hacerla opcional.
              </Text>
            </View>
            <Switch
              value={field.required !== false}
              onValueChange={(required) => update(index, { required })}
            />
          </Pressable>
        </View>
      ))}
      <Button
        variant="outline"
        onPress={() =>
          onChange([
            ...fields,
            {
              key: `pregunta_${Date.now()}_${fields.length + 1}`,
              label: "",
              type: "text",
              required: true,
            },
          ])
        }
      >
        <Text>+ Agregar pregunta</Text>
      </Button>
    </View>
  );
}
