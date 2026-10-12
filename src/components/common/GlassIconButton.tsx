import { useTheme } from "@/src/providers/ThemeProvider";
import Monicon from "@monicon/native";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { GlassSurface } from "./GlassSurface";

const PRIMARY = { light: "#981646", dark: "#c41d5b" } as const;

export type GlassIconButtonProps = {
  /** Icono Monicon (debe estar registrado en metro.config.js). */
  icon: string;
  accessibilityLabel: string;
  onPress: () => void;
  /** "primary": vidrio teñido del color primario para la acción principal. */
  variant?: "default" | "primary";
  disabled?: boolean;
  loading?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Botón circular de vidrio (Liquid Glass en iOS 26) con un icono. */
export function GlassIconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = "default",
  disabled = false,
  loading = false,
  size = 56,
  style,
}: GlassIconButtonProps) {
  const { colorScheme } = useTheme();
  const isPrimary = variant === "primary";
  const primary = PRIMARY[colorScheme];
  const iconColor = isPrimary ? "#ffffff" : primary;
  const inactive = disabled || loading;

  return (
    <GlassSurface
      colorScheme={colorScheme}
      // Sin `interactive`: en iOS 26 el vidrio interactivo atiende sus propios
      // toques y a veces se queda con el primero antes que el Pressable.
      tintColor={isPrimary ? primary : undefined}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)",
        },
        styles.center,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Pressable
        onPress={() => {
          if (Platform.OS === "ios") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onPress();
        }}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, busy: loading }}
        hitSlop={6}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        {loading ? (
          <ActivityIndicator color={iconColor} />
        ) : (
          <Monicon name={icon} size={size * 0.46} color={iconColor} />
        )}
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Cubre todo el círculo sin depender del flex del contenedor (GlassView y
  // BlurView envuelven a los hijos en vistas propias).
  pressable: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
