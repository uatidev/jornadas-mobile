import { THEME } from "@/src/components/ui/lib/theme";
import { Text } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import Monicon from "@monicon/native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

/** Tarjeta de sección de Configuración (mismo estilo que ServiceCard). */
export function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="bg-card dark:border dark:border-border" style={styles.card}>
      <Text
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        style={styles.title}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

type SettingsRowProps = {
  icon: string;
  title: string;
  description?: string;
  onPress?: () => void;
  destructive?: boolean;
  loading?: boolean;
  /** Contenido a la derecha (por ejemplo un Switch). Sin él se muestra un chevron. */
  right?: ReactNode;
  isLast?: boolean;
};

/** Fila de una SettingsCard: icono en círculo, título, descripción y acción. */
export function SettingsRow({
  icon,
  title,
  description,
  onPress,
  destructive = false,
  loading = false,
  right,
  isLast = false,
}: SettingsRowProps) {
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
  const accent = destructive ? palette.destructive : palette.primary;

  const content = (
    <View style={styles.row}>
      <View
        className={`items-center justify-center rounded-full ${destructive ? "bg-destructive/10" : "bg-primary/10"}`}
        style={styles.iconCircle}
      >
        <Monicon name={icon} size={22} color={accent} />
      </View>
      <View style={styles.texts}>
        <Text className={`font-semibold ${destructive ? "text-destructive" : "text-foreground"}`}>
          {title}
        </Text>
        {description ? (
          <Text className="text-xs text-muted-foreground">{description}</Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={accent} />
      ) : right !== undefined ? (
        right
      ) : onPress ? (
        <Monicon name="ci:chevron-right" size={22} color={palette.mutedForeground} />
      ) : null}
      {!isLast ? (
        <View style={[styles.divider, { backgroundColor: palette.border }]} />
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      className="active:opacity-70"
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 18,
    paddingBottom: 6,
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.07)",
  },
  title: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconCircle: {
    width: 42,
    height: 42,
  },
  texts: {
    flex: 1,
    gap: 4,
  },
  // Separador solo bajo el texto (como las listas de iOS), no bajo el icono.
  divider: {
    position: "absolute",
    left: 74,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
});
