import { THEME } from "@/src/components/ui/lib/theme";
import { Text } from "@/src/components/ui/text";
import type { MyRequestItem } from "@/src/hooks/useMyRequests";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Monicon } from "@monicon/native";
import { Pressable, StyleSheet, View } from "react-native";

const KIND_LABEL = {
  regular: "Trámite",
  secretary: "Secretaría",
} as const;

type RequestListItemProps = {
  item: MyRequestItem;
  onPress: () => void;
};

/** Fila del listado de Mis solicitudes (mismo estilo que ServiceCard). */
export function RequestListItem({ item, onPress }: RequestListItemProps) {
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
  const time = new Date(item.date).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Pressable
      className="bg-card active:opacity-70 dark:border dark:border-border"
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.folio}, ${item.title}. ${item.statusLabel}`}
    >
      <View style={styles.body}>
        <View style={styles.row}>
          <Text numberOfLines={1} className="flex-1 text-xs font-bold text-primary">
            {item.folio}
          </Text>
          <Text numberOfLines={1} className="text-xs font-medium text-muted-foreground">
            {item.statusLabel}
          </Text>
        </View>
        <Text numberOfLines={2} className="text-base font-semibold leading-5 text-foreground">
          {item.title}
        </Text>
        <View style={styles.row}>
          <Monicon
            name={item.kind === "secretary" ? "ci:building-03" : "ci:file-document"}
            size={14}
            color={palette.mutedForeground}
          />
          <Text numberOfLines={1} className="flex-1 text-xs text-muted-foreground">
            {[KIND_LABEL[item.kind], item.applicantName, time].filter(Boolean).join(" · ")}
          </Text>
          {item.priority ? (
            <Text className="text-xs font-semibold text-muted-foreground">Prioritaria</Text>
          ) : null}
        </View>
      </View>

      <Monicon name="ci:chevron-right" size={22} color={palette.primary} />
    </Pressable>
  );
}

/** Marcador de carga con la forma de RequestListItem. */
export function RequestListItemSkeleton() {
  return (
    <View className="bg-card dark:border dark:border-border" style={styles.card}>
      <View style={styles.body}>
        <View className="h-3 w-24 rounded bg-muted" />
        <View className="mt-1 h-4 w-4/5 rounded bg-muted" />
        <View className="mt-1 h-3 w-1/2 rounded bg-muted" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.07)",
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
