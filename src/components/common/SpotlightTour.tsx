import { THEME } from "@/src/components/ui/lib/theme";
import { Button } from "@/src/components/ui/button";
import { Text } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react";
import {
  BackHandler,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type View as ViewType,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type TourRect = { x: number; y: number; width: number; height: number };

const measureInWindow = (node: ViewType) =>
  new Promise<TourRect>((resolve) => {
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });

/**
 * Elementos que señala la guía. La medición solo se usa para hacer scroll hasta
 * el elemento: el resaltado se dibuja dentro del propio elemento, así que se ve
 * igual en iOS y Android aunque la medición falle.
 *
 * Las posiciones se calculan respecto a `rootRef` (la vista de la pantalla) para
 * que cualquier desfase de la ventana se cancele.
 */
export function useTourTargets(rootRef: RefObject<ViewType | null>) {
  const targets = useRef<Record<string, ViewType | null>>({});
  const targetRef = useCallback(
    (id: string) => (node: ViewType | null) => {
      targets.current[id] = node;
    },
    [],
  );
  const measure = useCallback(
    async (id: string): Promise<TourRect | null> => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const node = targets.current[id];
        const root = rootRef.current;
        if (node && root) {
          const [target, origin] = await Promise.all([measureInWindow(node), measureInWindow(root)]);
          if (target.width > 0 && target.height > 0)
            return { ...target, x: target.x - origin.x, y: target.y - origin.y };
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      return null;
    },
    [rootRef],
  );
  return { targetRef, measure };
}

/** Envuelve un elemento de la pantalla; cuando es el paso actual lo marca con un contorno. */
export function TourTarget({
  id,
  activeId,
  targetRef,
  className,
  style,
  children,
}: {
  id: string;
  activeId?: string;
  targetRef: (id: string) => (node: ViewType | null) => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { colorScheme } = useTheme();
  const active = id === activeId;
  return (
    // collapsable={false}: Android elimina vistas "vacías" y no se podrían medir.
    <View ref={targetRef(id)} collapsable={false} className={className} style={style}>
      {children}
      {active ? (
        <View
          pointerEvents="none"
          style={[styles.ring, { borderColor: THEME[colorScheme].primary }]}
        />
      ) : null}
    </View>
  );
}

/**
 * Tarjeta fija al pie de la pantalla con la explicación del paso. No cubre la
 * pantalla: el contenido sigue visible y se puede desplazar por encima de ella.
 */
export function TourCard({
  title,
  body,
  index,
  total,
  onNext,
  onPrev,
  onSkip,
  onLayout,
}: {
  title: string;
  body: string;
  index: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const insets = useSafeAreaInsets();
  const isLast = index === total - 1;

  // En Android, el botón "atrás" cierra la guía en lugar de salir de la pantalla.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onSkip();
      return true;
    });
    return () => subscription.remove();
  }, [onSkip]);

  return (
    <View
      accessibilityLiveRegion="polite"
      onLayout={onLayout}
      className="rounded-3xl border border-border bg-card p-5"
      style={[styles.card, { bottom: insets.bottom + 12 }]}
    >
      <Text className="text-xs text-muted-foreground">
        Paso {index + 1} de {total}
      </Text>
      <Text className="mt-1 text-lg font-semibold text-foreground">{title}</Text>
      <Text className="mt-1.5 text-sm leading-5 text-muted-foreground">{body}</Text>

      <View className="mt-4 flex-row items-center gap-2">
        {!isLast ? (
          <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={8} className="py-2 pr-2">
            <Text className="text-sm text-muted-foreground">Saltar guía</Text>
          </Pressable>
        ) : null}
        <View className="flex-1" />
        {index > 0 ? (
          <Button variant="outline" size="sm" onPress={onPrev}>
            <Text>Anterior</Text>
          </Button>
        ) : null}
        <Button size="sm" onPress={onNext}>
          <Text>{isLast ? "Terminar" : "Siguiente"}</Text>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderWidth: 2,
    borderRadius: 22,
  },
  card: {
    position: "absolute",
    left: 16,
    right: 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
});
