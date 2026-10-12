import { Text } from "@/src/components/ui/text";
import { View } from "react-native";

const detailValue = (value: unknown) => {
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value !== "string") return String(value ?? "—");
  try {
    const parsed = JSON.parse(value);
    return parsed?.name ? `Archivo: ${parsed.name}` : value;
  } catch {
    return value || "—";
  }
};

type DetailRowsProps = {
  data?: Record<string, unknown>;
  labels?: Record<string, string>;
};

/** Lista de pares etiqueta/valor de los datos capturados en un formulario. */
export function DetailRows({ data, labels = {} }: DetailRowsProps) {
  const entries = Object.entries(data || {}).filter(([, value]) => value !== "" && value != null);
  if (!entries.length) {
    return <Text className="text-sm text-muted-foreground">Sin información adicional.</Text>;
  }
  return (
    <View>
      {entries.map(([key, value], index) => (
        <DetailRow
          key={key}
          label={labels[key] || key.replace(/^pregunta_?/, "Pregunta ").replaceAll("_", " ")}
          value={detailValue(value)}
          last={index === entries.length - 1}
        />
      ))}
    </View>
  );
}

export function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`py-2.5 ${last ? "" : "border-b border-border/50"}`}>
      <Text className="text-[11px] font-bold uppercase text-muted-foreground">{label}</Text>
      <Text className="mt-1 text-sm text-foreground">{value}</Text>
    </View>
  );
}
