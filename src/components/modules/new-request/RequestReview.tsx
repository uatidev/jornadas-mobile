import { DetailRow } from "@/src/components/modules/mis-solicitudes";
import { THEME } from "@/src/components/ui/lib/theme";
import { Switch } from "@/src/components/ui/switch";
import { Text } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import type { ServiceFormField } from "@/src/types/catalog";
import Monicon from "@monicon/native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Valor capturado en un texto legible (archivos, opciones múltiples y fechas). */
const readableValue = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    const files = (Array.isArray(parsed) ? parsed : [parsed]).filter((item) => item?.fileId);
    if (files.length) {
      return files.length === 1
        ? files[0].name
        : `${files.length} archivos: ${files.map((file) => file.name).join(", ")}`;
    }
  } catch {
    // No es JSON: se muestra tal cual.
  }
  if (DATE_PATTERN.test(value)) {
    const date = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
    }
  }
  return value.includes("|")
    ? value.split("|").map((item) => item.trim()).filter(Boolean).join(", ")
    : value;
};

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <View className="bg-card dark:border dark:border-border" style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </Text>
        {onEdit ? (
          <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Editar ${title}`}>
            <Text className="text-sm font-semibold text-primary">Editar</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** Filas etiqueta/valor de los campos capturados, en el orden del formulario. */
function FieldRows({ fields, values }: { fields: ServiceFormField[]; values: Record<string, string> }) {
  const known = new Set(fields.map((field) => field.key));
  const rows = [
    ...fields.map((field) => ({ key: field.key, label: field.label, value: values[field.key]?.trim() })),
    // Datos que no están en la configuración (por ejemplo de un formulario anterior).
    ...Object.entries(values)
      .filter(([key]) => !known.has(key))
      .map(([key, value]) => ({ key, label: key.replaceAll("_", " "), value: value?.trim() })),
  ].filter((row) => row.value);

  if (!rows.length) {
    return <Text className="py-2.5 text-sm text-muted-foreground">Sin información capturada.</Text>;
  }
  return (
    <>
      {rows.map((row, index) => (
        <DetailRow
          key={row.key}
          label={row.label}
          value={readableValue(row.value!)}
          last={index === rows.length - 1}
        />
      ))}
    </>
  );
}

type RequestReviewProps = {
  serviceTitle: string;
  eventName?: string;
  globalFields: ServiceFormField[];
  globalData: Record<string, string>;
  specificFields: ServiceFormField[];
  specificData: Record<string, string>;
  onEditGlobal?: () => void;
  onEditSpecific: () => void;
  canSetPriority: boolean;
  forcedPriority: boolean;
  priority: boolean;
  onPriorityChange: (value: boolean) => void;
  error?: string | null;
};

/** Paso 4: resumen de la solicitud antes de enviarla. */
export function RequestReview({
  serviceTitle,
  eventName,
  globalFields,
  globalData,
  specificFields,
  specificData,
  onEditGlobal,
  onEditSpecific,
  canSetPriority,
  forcedPriority,
  priority,
  onPriorityChange,
  error,
}: RequestReviewProps) {
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];

  return (
    <View style={styles.container}>
      <View className="bg-card dark:border dark:border-border" style={[styles.card, styles.hero]}>
        <View style={styles.heroTexts}>
          <Text className="text-xs text-muted-foreground">Estás por enviar</Text>
          <Text className="text-base font-bold">{serviceTitle}</Text>
          {eventName ? <Text className="text-xs text-muted-foreground">{eventName}</Text> : null}
        </View>
      </View>

      {onEditGlobal ? (
        <ReviewSection title="Datos del solicitante" onEdit={onEditGlobal}>
          <FieldRows fields={globalFields} values={globalData} />
        </ReviewSection>
      ) : null}

      <ReviewSection title="Datos del trámite" onEdit={onEditSpecific}>
        <FieldRows fields={specificFields} values={specificData} />
      </ReviewSection>

      {canSetPriority ? (
        <View className="bg-card dark:border dark:border-border" style={[styles.card, styles.priority]}>
          <View
            className={`items-center justify-center rounded-full ${priority ? "bg-primary" : "bg-primary/10"}`}
            style={styles.iconCircle}
          >
            <Monicon name="mdi:trending-up" size={22} color={priority ? "#ffffff" : palette.primary} />
          </View>
          <View style={styles.heroTexts}>
            <Text className="font-semibold">Solicitud prioritaria</Text>
            <Text className="text-xs text-muted-foreground">
              {forcedPriority
                ? "Las solicitudes de Secretaría se envían siempre como prioritarias."
                : "Actívala si requiere atención prioritaria de la unidad responsable."}
            </Text>
          </View>
          <Switch checked={priority} disabled={forcedPriority} onCheckedChange={onPriorityChange} />
        </View>
      ) : null}

      <Text className="px-2 text-center text-xs text-muted-foreground">
        Revisa que los datos sean correctos. Al enviar se generará el folio de la solicitud.
      </Text>

      {error ? (
        <View className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <Text className="text-sm text-destructive">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    width: "100%",
    borderRadius: 18,
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.07)",
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  heroTexts: {
    flex: 1,
    gap: 2,
  },
  iconCircle: {
    width: 42,
    height: 42,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 2,
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  priority: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
});
