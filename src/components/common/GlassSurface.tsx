import { BlurView } from "expo-blur";
import {
  GlassView,
  isLiquidGlassAvailable,
  type GlassEffectStyleConfig,
  type GlassStyle,
} from "expo-glass-effect";
import type { ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/** true cuando el dispositivo soporta Liquid Glass nativo (iOS 26+). */
export const liquidGlassEnabled =
  Platform.OS === "ios" && isLiquidGlassAvailable();

export type GlassSurfaceProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  colorScheme: "light" | "dark";
  /** Brillo al tocar (solo Liquid Glass). Útil en botones y barras. */
  interactive?: boolean;
  /** Color del vidrio (por ejemplo el primario para acciones principales). */
  tintColor?: string;
  /**
   * Estilo del Liquid Glass (iOS 26). Permite que el vidrio aparezca con su
   * animación nativa: `{ style: "regular", animate: true }`.
   */
  glassEffectStyle?: GlassStyle | GlassEffectStyleConfig;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * Superficie de vidrio que se adapta a la plataforma:
 * - iOS 26+: Liquid Glass nativo (`expo-glass-effect`).
 * - iOS anterior y web: desenfoque real (`expo-blur`).
 * - Android: superficie translúcida tipo vidrio esmerilado.
 */
export function GlassSurface({
  children,
  style,
  colorScheme,
  interactive = false,
  tintColor,
  glassEffectStyle = "regular",
  onLayout,
}: GlassSurfaceProps) {
  // iOS 26+: Liquid Glass nativo.
  if (liquidGlassEnabled) {
    return (
      <GlassView
        glassEffectStyle={glassEffectStyle}
        colorScheme={colorScheme}
        isInteractive={interactive}
        tintColor={tintColor}
        style={style}
        onLayout={onLayout}
      >
        {children}
      </GlassView>
    );
  }

  const isDark = colorScheme === "dark";
  const glassBorder = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.7)",
  };

  // Con color propio o en Android (el blur nativo exige envolver las pantallas
  // en un BlurTargetView) se usa una superficie translúcida tipo vidrio esmerilado.
  if (tintColor || Platform.OS === "android") {
    return (
      <View
        onLayout={onLayout}
        style={[
          style,
          glassBorder,
          {
            backgroundColor:
              tintColor ??
              (isDark ? "rgba(28,28,30,0.92)" : "rgba(255,255,255,0.94)"),
          },
        ]}
      >
        {children}
      </View>
    );
  }

  // iOS < 26 y web: blur real.
  return (
    <BlurView
      tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
      intensity={80}
      onLayout={onLayout}
      style={[style, glassBorder, { overflow: "hidden" }]}
    >
      {children}
    </BlurView>
  );
}
