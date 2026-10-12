import { THEME } from "@/src/components/ui/lib/theme";
import { Text } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import Monicon from "@monicon/native";
import { useEffect, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// Colores en hex/rgba: interpolateColor de Reanimated no entiende hsl con espacios.
export const GLASS_FIELD_COLORS = {
  light: {
    primary: "#981646",
    destructive: "#ef4444",
    // Borde oscuro sutil para que el campo se distinga también sobre fondo blanco.
    border: "rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.7)",
    restingShadow: "0 2px 10px rgba(0,0,0,0.06)",
  },
  dark: {
    primary: "#c41d5b",
    destructive: "#ef4444",
    border: "rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    restingShadow: "0 2px 10px rgba(0,0,0,0.3)",
  },
} as const;

export const GLASS_FIELD_RADIUS = 16;
/** La burbuja de ayuda se cierra sola después de este tiempo. */
const HELP_AUTO_CLOSE_MS = 6000;

/**
 * Estilo de la caja del campo: fondo translúcido y borde que pasa al color
 * primario (o rojo si hay error) cuando el campo está activo.
 */
export function useGlassFieldBoxStyle(active: boolean, hasError: boolean) {
  const { colorScheme } = useTheme();
  const colors = GLASS_FIELD_COLORS[colorScheme];

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active, progress]);

  const activeColor = hasError ? colors.destructive : colors.primary;
  const restingColor = hasError ? colors.destructive : colors.border;

  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [restingColor, activeColor],
    ),
  }));

  const staticStyle: ViewStyle = {
    backgroundColor: colors.background,
    boxShadow: active
      ? hasError
        ? "0 0 0 3px rgba(239,68,68,0.22)"
        : "0 0 0 3px rgba(152,22,70,0.22)"
      : colors.restingShadow,
  };

  return { colors, boxStyle: [staticStyle, animatedBorder] };
}

export type GlassFieldFrameProps = {
  label?: string;
  required?: boolean;
  /** Texto de ayuda que se abre al tocar el icono ⓘ (arriba a la derecha). */
  help?: string;
  /** Mensaje de error; si hay, reemplaza al helperText. */
  message?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Marco común de los campos glass: título con *, icono de ayuda con burbuja,
 * el campo y debajo el error o el texto de ayuda.
 */
export function GlassFieldFrame({
  label,
  required = false,
  help,
  message,
  helperText,
  containerStyle,
  children,
}: GlassFieldFrameProps) {
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
  const colors = GLASS_FIELD_COLORS[colorScheme];
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (!helpOpen) return;
    const timer = setTimeout(() => setHelpOpen(false), HELP_AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [helpOpen]);

  return (
    <View style={[styles.container, containerStyle]}>
      {label || help ? (
        <View style={styles.labelRow}>
          {label ? (
            <Text className="flex-1 text-sm font-medium">
              {label}
              {required ? <Text className="text-primary"> *</Text> : null}
            </Text>
          ) : (
            <View style={styles.flex} />
          )}
          {help ? (
            <Pressable
              onPress={() => setHelpOpen((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={`Ayuda: ${label ?? ""}`}
              accessibilityState={{ expanded: helpOpen }}
              hitSlop={10}
            >
              <Monicon
                name="mdi:information-outline"
                size={18}
                color={helpOpen ? colors.primary : palette.mutedForeground}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {help && helpOpen ? (
        // Burbuja dentro del flujo (sin portal): no depende de medir posiciones,
        // así que funciona igual en iOS, Android y web.
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)}>
          <View style={[styles.helpCaret, { borderBottomColor: colors.primary }]} />
          <Pressable
            onPress={() => setHelpOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar ayuda"
            style={[styles.helpBubble, { backgroundColor: colors.primary }]}
          >
            <Text className="text-xs text-white">{help}</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {children}

      {message ? (
        <Text className="text-sm text-destructive">{message}</Text>
      ) : helperText ? (
        <Text className="text-xs text-muted-foreground">{helperText}</Text>
      ) : null}
    </View>
  );
}

export const glassFieldStyles = StyleSheet.create({
  box: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: GLASS_FIELD_RADIUS,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  disabled: {
    opacity: 0.5,
  },
});

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  flex: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  helpCaret: {
    alignSelf: "flex-end",
    marginRight: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  helpBubble: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
