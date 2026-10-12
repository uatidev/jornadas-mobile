import { THEME } from "@/src/components/ui/lib/theme";
import { cn } from "@/src/components/ui/lib/utils";
import { Text } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import { BlurView } from "expo-blur";
import type { ReactNode, Ref } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Alto de la barra compacta (sin contar la zona segura superior). */
export const COLLAPSED_HEADER_HEIGHT = 44;

export type CollapsingHeaderScrollViewProps = Omit<
  ScrollViewProps,
  "onScroll" | "children"
> & {
  title: string;
  subtitle?: string;
  largeTitleAlign?: "left" | "center";
  /** Clases extra para el título grande (por ejemplo `text-white`). */
  largeTitleClassName?: string;
  subtitleClassName?: string;
  /**
   * Contenido fijo a la izquierda de la barra compacta (por ejemplo un botón
   * de regresar). Siempre visible; el título grande se coloca debajo de ella.
   */
  headerLeft?: ReactNode;
  children: ReactNode;
  ref?: Ref<ScrollView>;
};

/**
 * ScrollView con título grande que, al hacer scroll, se esconde bajo una barra
 * compacta con desenfoque y título pequeño (estilo iOS / WhatsApp / Ionic
 * `collapse="condense"`). Funciona igual en iOS, Android y web.
 */
export function CollapsingHeaderScrollView({
  title,
  subtitle,
  largeTitleAlign = "left",
  largeTitleClassName,
  subtitleClassName,
  headerLeft,
  contentContainerStyle,
  children,
  ref,
  ...scrollViewProps
}: CollapsingHeaderScrollViewProps) {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
  const isDark = colorScheme === "dark";

  const scrollY = useSharedValue(0);
  const largeTitleHeight = useSharedValue(60);

  // onScroll normal (no useAnimatedScrollHandler): con un RefreshControl en
  // Android el handler de Reanimated queda en la vista que envuelve al scroll
  // y deja de recibir eventos.
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  const onLargeTitleLayout = (event: LayoutChangeEvent) => {
    largeTitleHeight.value = Math.max(event.nativeEvent.layout.height, 1);
  };

  // La barra aparece mientras el título grande se esconde debajo de ella.
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [largeTitleHeight.value * 0.3, largeTitleHeight.value * 0.7],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const smallTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [largeTitleHeight.value * 0.6, largeTitleHeight.value],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [largeTitleHeight.value * 0.6, largeTitleHeight.value],
          [6, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Al jalar hacia abajo el título grande crece un poco, como en iOS.
  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, largeTitleHeight.value * 0.8],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [-120, 0],
          [1.1, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const centered = largeTitleAlign === "center";

  return (
    <View style={styles.root}>
      <ScrollView
        ref={ref}
        {...scrollViewProps}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // El scroll empieza debajo de la barra de estado: así el indicador de
        // "jalar para recargar" no queda detrás del notch y no hace falta
        // contentInset (que con RefreshControl desplaza la posición inicial en iOS).
        style={[styles.root, { marginTop: topInset }, scrollViewProps.style]}
        contentContainerStyle={[
          contentContainerStyle,
          // Con headerLeft el título grande empieza debajo de la barra compacta.
          { paddingTop: 8 + (headerLeft ? COLLAPSED_HEADER_HEIGHT : 0) },
        ]}
      >
        <Animated.View
          onLayout={onLargeTitleLayout}
          style={[
            styles.largeTitle,
            { transformOrigin: centered ? "center" : "left" },
            largeTitleStyle,
          ]}
        >
          <Text
            className={cn(
              "text-3xl font-bold",
              centered && "text-center",
              largeTitleClassName,
            )}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              className={cn(
                "mt-1 text-sm text-muted-foreground",
                centered && "text-center",
                subtitleClassName,
              )}
            >
              {subtitle}
            </Text>
          ) : null}
        </Animated.View>
        {children}
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[
          styles.header,
          {
            height: topInset + COLLAPSED_HEADER_HEIGHT,
            paddingTop: topInset,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, barStyle]}
        >
          {Platform.OS === "android" ? (
            // Android: el blur nativo exige un BlurTargetView; se usa fondo sólido.
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: palette.background, opacity: 0.97 },
              ]}
            />
          ) : (
            <BlurView
              tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
              intensity={90}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View
            style={[styles.hairline, { backgroundColor: palette.border }]}
          />
        </Animated.View>
        <Animated.Text
          pointerEvents="none"
          numberOfLines={1}
          style={[styles.smallTitle, { color: palette.foreground }, smallTitleStyle]}
        >
          {title}
        </Animated.Text>
        {headerLeft ? (
          <View
            style={[
              styles.headerLeft,
              { top: topInset, height: COLLAPSED_HEADER_HEIGHT },
            ]}
          >
            {headerLeft}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  largeTitle: {
    marginBottom: 16,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLeft: {
    position: "absolute",
    left: 16,
    justifyContent: "center",
  },
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  smallTitle: {
    fontFamily: "Poppins",
    fontSize: 17,
    fontWeight: "600",
    paddingHorizontal: 56,
  },
});
