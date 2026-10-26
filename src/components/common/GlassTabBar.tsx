import { THEME } from "@/src/components/ui/lib/theme";
import { useTheme } from "@/src/providers/ThemeProvider";
import Monicon from "@monicon/native";
import { GlassContainer } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import type { Tabs } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle
} from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSurface, liquidGlassEnabled } from "./GlassSurface";

/** Alto de la píldora y diámetro del botón de acción. */
export const GLASS_TAB_BAR_HEIGHT = 64;
const HORIZONTAL_MARGIN = 16;
const ACTION_GAP = 10;
const BAR_PADDING = 6;
const INDICATOR_SPRING = { damping: 18, stiffness: 190, mass: 0.8 };
const TAB_LAYOUT_TRANSITION = LinearTransition.springify()
  .damping(INDICATOR_SPRING.damping)
  .stiffness(INDICATOR_SPRING.stiffness)
  .mass(INDICATOR_SPRING.mass);
/** Ancho mínimo de una pestaña que solo muestra el icono. */
const MIN_ICON_TAB_WIDTH = 48;
/** Ancho máximo de la pestaña activa (icono + título). */
const MAX_ACTIVE_TAB_WIDTH = 150;

type TabBarRenderProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

export type GlassTabBarProps = TabBarRenderProps & {
  /** Oculta la barra (por ejemplo en web de escritorio). */
  hidden?: boolean;
  /** Icono Monicon del botón circular. Debe estar registrado en metro.config.js. */
  actionIcon?: string;
  actionAccessibilityLabel?: string;
  /** Si no se pasa, no se muestra el botón circular y la barra ocupa todo el ancho. */
  onActionPress?: () => void;
};

function getBottomOffset(bottomInset: number) {
  return Math.max(bottomInset - 8, 12);
}

/**
 * Espacio inferior que debe reservar el contenido scrolleable de una pestaña
 * para no quedar oculto detrás de la barra flotante.
 */
export function useGlassTabBarSpace() {
  const insets = useSafeAreaInsets();
  return getBottomOffset(insets.bottom) + GLASS_TAB_BAR_HEIGHT + 16;
}

export function GlassTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  hidden = false,
  actionIcon = "mdi:plus",
  actionAccessibilityLabel = "Acción",
  onActionPress,
}: GlassTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const [barWidth, setBarWidth] = useState(0);

  const visibleRoutes = state.routes.filter((route) => {
    const itemStyle = StyleSheet.flatten(
      descriptors[route.key].options.tabBarItemStyle,
    );
    // expo-router marca las pestañas con `href: null` como display: "none".
    return itemStyle?.display !== "none";
  });
  const focusedKey = state.routes[state.index]?.key;
  const focusedIndex = visibleRoutes.findIndex((route) => route.key === focusedKey);
  // La pestaña activa se ensancha para mostrar el título; el resto comparte
  // el espacio sobrante y solo muestra el icono.
  // Fuera de Liquid Glass la superficie lleva un borde que también ocupa ancho.
  const borderWidth = liquidGlassEnabled ? 0 : StyleSheet.hairlineWidth;
  const innerWidth = Math.max(barWidth - (BAR_PADDING + borderWidth) * 2, 0);
  const iconTabCount = Math.max(visibleRoutes.length - 1, 0);
  const activeTabWidth =
    iconTabCount === 0
      ? innerWidth
      : Math.min(innerWidth - iconTabCount * MIN_ICON_TAB_WIDTH, MAX_ACTIVE_TAB_WIDTH);
  const iconTabWidth =
    iconTabCount === 0 ? 0 : (innerWidth - activeTabWidth) / iconTabCount;
  const layoutReady = barWidth > 0 && focusedIndex >= 0;

  // El resaltado se desliza y cambia de ancho con un resorte.
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  useEffect(() => {
    if (!layoutReady) {
      return;
    }
    const x = focusedIndex * iconTabWidth;
    // Primera medición: colocar sin animar.
    if (indicatorWidth.value === 0) {
      indicatorX.value = x;
      indicatorWidth.value = activeTabWidth;
      return;
    }
    indicatorX.value = withSpring(x, INDICATOR_SPRING);
    indicatorWidth.value = withSpring(activeTabWidth, INDICATOR_SPRING);
  }, [layoutReady, focusedIndex, iconTabWidth, activeTabWidth, indicatorX, indicatorWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.value,
    opacity: indicatorWidth.value > 0 ? 1 : 0,
    transform: [{ translateX: indicatorX.value }],
  }));

  if (hidden) {
    return null;
  }

  const palette = THEME[colorScheme];
  const activeBackground =
    colorScheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(141,22,69,0.10)";

  const shadow: ViewStyle = liquidGlassEnabled
    ? {}
    : {
      shadowColor: "#000",
      shadowOpacity: colorScheme === "dark" ? 0.4 : 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    };

  const containerStyle = [
    styles.container,
    { bottom: getBottomOffset(insets.bottom) },
  ];

  const content = (
    <>
      <GlassSurface
        interactive
        colorScheme={colorScheme}
        style={[styles.bar, shadow]}
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { backgroundColor: activeBackground },
            indicatorStyle,
          ]}
        />
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = route.key === focusedKey;
          const color = isFocused ? palette.primary : palette.foreground;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : (options.title ?? route.name);

          const onPress = () => {
            // Desde SDK 58 la barra recibe `emitter` y `navigateToTab` en lugar de `navigation`.
            const event = emitter.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              if (Platform.OS === "ios") {
                Haptics.selectionAsync();
              }
              navigateToTab(route.key);
            }
          };

          const onLongPress = () => {
            emitter.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Animated.View
              key={route.key}
              // En Android la transición de layout deja el contenido con el
              // ancho anterior; ahí basta con el indicador animado.
              layout={Platform.OS === "android" ? undefined : TAB_LAYOUT_TRANSITION}
              style={
                layoutReady
                  ? { width: isFocused ? activeTabWidth : iconTabWidth }
                  : styles.tabFallback
              }
            >
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tab}
              >
                <View style={styles.icon}>
                  {options.tabBarIcon?.({ focused: isFocused, color, size: 28 })}
                </View>
                {isFocused ? (
                  <Animated.Text
                    entering={FadeIn.delay(90).duration(160)}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    maxFontSizeMultiplier={1.2}
                    style={[styles.label, { color }]}
                  >
                    {label}
                  </Animated.Text>
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </GlassSurface>

      {onActionPress ? (
        <GlassSurface
          interactive
          colorScheme={colorScheme}
          style={[styles.action, shadow]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionAccessibilityLabel}
            onPress={() => {
              if (Platform.OS === "ios") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onActionPress();
            }}
            style={styles.actionPressable}
          >
            <Monicon name={actionIcon} size={26} color={palette.primary} />
          </Pressable>
        </GlassSurface>
      ) : null}
    </>
  );

  // En iOS 26 el GlassContainer funde ambas superficies como una sola gota.
  return liquidGlassEnabled ? (
    <GlassContainer spacing={ACTION_GAP} pointerEvents="box-none" style={containerStyle}>
      {content}
    </GlassContainer>
  ) : (
    <View pointerEvents="box-none" style={containerStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: HORIZONTAL_MARGIN,
    right: HORIZONTAL_MARGIN,
    flexDirection: "row",
    alignItems: "center",
    gap: ACTION_GAP,
  },
  bar: {
    flex: 1,
    height: GLASS_TAB_BAR_HEIGHT,
    borderRadius: GLASS_TAB_BAR_HEIGHT / 2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: BAR_PADDING,
  },
  indicator: {
    position: "absolute",
    left: BAR_PADDING,
    top: BAR_PADDING,
    height: GLASS_TAB_BAR_HEIGHT - BAR_PADDING * 2,
    borderRadius: (GLASS_TAB_BAR_HEIGHT - BAR_PADDING * 2) / 2,
  },
  tabFallback: {
    flex: 1,
  },
  tab: {
    width: "100%",
    height: GLASS_TAB_BAR_HEIGHT - BAR_PADDING * 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    overflow: "hidden",
  },
  icon: {
    flexShrink: 0,
  },
  label: {
    flexShrink: 1,
    includeFontPadding: false,
    fontSize: 13,
    fontWeight: "600",
  },
  action: {
    width: GLASS_TAB_BAR_HEIGHT,
    height: GLASS_TAB_BAR_HEIGHT,
    borderRadius: GLASS_TAB_BAR_HEIGHT / 2,
  },
  actionPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
