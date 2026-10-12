import { THEME } from "@/src/components/ui/lib/theme";
import { Text } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import Monicon from "@monicon/native";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassFieldFrame, glassFieldStyles, useGlassFieldBoxStyle } from "./GlassField";
import { GlassSurface, liquidGlassEnabled } from "./GlassSurface";

export type GlassSelectOption = {
  label: string;
  value: string;
  description?: string;
};

type GlassSelectBaseProps = {
  label?: string;
  placeholder?: string;
  /** Opciones como objetos o como textos (el texto se usa como valor y etiqueta). */
  options: readonly (GlassSelectOption | string)[];
  /** Marca el campo con * y muestra un error si se cierra sin elegir nada. */
  required?: boolean;
  requiredMessage?: string;
  /** Error externo (por ejemplo de react-hook-form). Tiene prioridad. */
  error?: string;
  helperText?: string;
  /** Texto de ayuda que se abre al tocar el icono ⓘ (arriba a la derecha). */
  help?: string;
  /** Icono Monicon dentro del campo, a la izquierda (debe estar en metro.config.js). */
  leftIcon?: string;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

type GlassSelectSingleProps = GlassSelectBaseProps & {
  multiple?: false;
  value?: string;
  onChange: (value: string) => void;
};

type GlassSelectMultipleProps = GlassSelectBaseProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

export type GlassSelectProps = GlassSelectSingleProps | GlassSelectMultipleProps;

type Anchor = { x: number; y: number; width: number; height: number };

const MENU_GAP = 6;
const MENU_MAX_HEIGHT = 360;
const OPTION_HEIGHT = 48;
const SCREEN_MARGIN = 12;
const ANIMATION_MS = 160;
/** En iOS no se anima la opacidad del contenedor (rompe el vidrio/blur nativo). */
const FADE_CONTAINER = Platform.OS !== "ios";

/**
 * Select con estilo vidrio. Abre un menú flotante pegado al campo (como los
 * menús de WhatsApp/iOS) con Liquid Glass en iOS 26. `multiple` permite elegir
 * varias opciones; el menú se cierra al tocar fuera.
 */
export function GlassSelect(props: GlassSelectProps) {
  const {
    label,
    placeholder = "Selecciona una opción",
    options: rawOptions,
    required = false,
    requiredMessage = "Selecciona una opción.",
    error,
    helperText,
    help,
    leftIcon,
    disabled = false,
    containerStyle,
  } = props;
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const triggerRef = useRef<View>(null);

  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [touched, setTouched] = useState(false);
  const [triggerSize, setTriggerSize] = useState({ width: 0, height: 0 });
  // Alto real del Modal y del menú: en Android (edge-to-edge) el alto de
  // useWindowDimensions no siempre coincide con el área donde se dibuja el Modal.
  const [modalHeight, setModalHeight] = useState(0);
  const [menuHeight, setMenuHeight] = useState(0);
  const open = anchor !== null;
  const measured = open && modalHeight > 0 && menuHeight > 0;

  const options = useMemo<GlassSelectOption[]>(
    () =>
      rawOptions.map((option) =>
        typeof option === "string" ? { label: option, value: option } : option,
      ),
    [rawOptions],
  );
  const selectedValues = props.multiple
    ? props.value
    : props.value
      ? [props.value]
      : [];
  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value),
  );

  const message =
    error ||
    (required && touched && !selectedValues.length ? requiredMessage : undefined);
  const { colors, boxStyle } = useGlassFieldBoxStyle(open, Boolean(message));

  // Aparece con un fundido y una escala ligera, como un menú nativo.
  const progress = useSharedValue(0);
  useEffect(() => {
    // Se anima hasta tener las medidas, para que no se vea un salto de posición.
    if (measured) {
      progress.set(0);
      progress.set(
        withTiming(1, { duration: ANIMATION_MS, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, [measured, progress]);

  // Abajo del campo si cabe; si no, arriba.
  const screenHeight = modalHeight || windowHeight;
  const estimatedHeight = Math.min(options.length * OPTION_HEIGHT + 12, MENU_MAX_HEIGHT);
  const spaceBelow = anchor
    ? screenHeight - (anchor.y + anchor.height) - insets.bottom - SCREEN_MARGIN
    : 0;
  const spaceAbove = anchor ? anchor.y - insets.top - SCREEN_MARGIN : 0;
  const placeAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
  const menuMaxHeight = Math.min(
    MENU_MAX_HEIGHT,
    (placeAbove ? spaceAbove : spaceBelow) - MENU_GAP,
  );

  // En iOS el contenedor NO anima su opacidad: las vistas de vidrio/blur
  // (UIVisualEffectView) dejan de dibujar el efecto si un padre tiene opacidad < 1.
  const menuStyle = useAnimatedStyle(() => ({
    opacity: FADE_CONTAINER ? progress.value : 1,
    transform: [{ scale: 0.94 + progress.value * 0.06 }],
  }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  // La posición sale del propio toque (pageY - locationY = borde superior del
  // campo). Es la coordenada nativa actual, aunque el scroll se haya movido;
  // medir con el árbol de layout puede quedar desfasado tras hacer scroll.
  const openMenu = (event: GestureResponderEvent) => {
    const { pageX, pageY, locationX, locationY } = event.nativeEvent;
    if (Number.isFinite(pageY) && triggerSize.width > 0) {
      setAnchor({
        x: pageX - locationX,
        y: pageY - locationY,
        width: triggerSize.width,
        height: triggerSize.height,
      });
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  };

  const close = () => {
    // .set(): forma compatible con React Compiler de actualizar un shared value.
    progress.set(withTiming(0, { duration: 120 }));
    setTimeout(() => {
      setAnchor(null);
      setMenuHeight(0);
      setTouched(true);
    }, 120);
  };

  const toggle = (value: string) => {
    if (Platform.OS === "ios") Haptics.selectionAsync();
    if (props.multiple) {
      props.onChange(
        props.value.includes(value)
          ? props.value.filter((item) => item !== value)
          : [...props.value, value],
      );
      return;
    }
    props.onChange(value);
    close();
  };

  const displayText = props.multiple
    ? selectedOptions.length > 2
      ? `${selectedOptions.length} seleccionadas`
      : selectedOptions.map((option) => option.label).join(", ")
    : selectedOptions[0]?.label;

  return (
    <GlassFieldFrame
      label={label}
      required={required}
      help={help}
      message={message}
      helperText={helperText}
      containerStyle={containerStyle}
    >
      <Pressable
        onPress={openMenu}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        accessibilityValue={{ text: displayText || placeholder }}
        accessibilityState={{ disabled, expanded: open }}
      >
        {/* pointerEvents="none": el toque lo recibe el Pressable, así locationX/Y
            son relativos al campo completo y no a un hijo (texto o icono). */}
        <View
          ref={triggerRef}
          collapsable={false}
          pointerEvents="none"
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setTriggerSize({ width, height });
          }}
        >
        <Animated.View
          style={[glassFieldStyles.box, disabled && glassFieldStyles.disabled, boxStyle]}
        >
          {leftIcon ? (
            <View style={styles.leadingIcon}>
              <Monicon
                name={leftIcon}
                size={20}
                color={open ? colors.primary : palette.mutedForeground}
              />
            </View>
          ) : null}
          <Text
            numberOfLines={1}
            className={`flex-1 py-3 text-base ${displayText ? "text-foreground" : "text-muted-foreground"}`}
          >
            {displayText || placeholder}
          </Text>
          <Monicon
            name="ci:chevron-down"
            size={20}
            color={open ? colors.primary : palette.mutedForeground}
          />
        </Animated.View>
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View
          style={styles.modalRoot}
          onLayout={(event) => setModalHeight(event.nativeEvent.layout.height)}
        >
        {/* Tocar fuera cierra el menú (sin oscurecer la pantalla, como en iOS). */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityLabel="Cerrar menú"
        />
        {anchor ? (
          <Animated.View
            onLayout={(event) => setMenuHeight(event.nativeEvent.layout.height)}
            style={[
              styles.menuPosition,
              {
                left: anchor.x,
                width: anchor.width,
                // Siempre con `top`: encima del campo (restando el alto medido
                // del menú) o debajo de él.
                // Fuera de pantalla hasta medir el menú (sin tocar la opacidad).
                top: !measured
                  ? -10000
                  : placeAbove
                    ? anchor.y - menuHeight - MENU_GAP
                    : anchor.y + anchor.height + MENU_GAP,
                transformOrigin: placeAbove ? "bottom" : "top",
              },
              menuStyle,
            ]}
          >
            <GlassSurface
              colorScheme={colorScheme}
              style={styles.menu}
              // El vidrio aparece con su propia animación nativa.
              glassEffectStyle={
                liquidGlassEnabled && measured
                  ? { style: "regular", animate: true, animationDuration: 0.2 }
                  : liquidGlassEnabled
                    ? "none"
                    : "regular"
              }
            >
              <Animated.View style={contentStyle}>
              <ScrollView
                style={{ maxHeight: menuMaxHeight }}
                contentContainerStyle={styles.menuContent}
                bounces={false}
              >
                {options.map((option, index) => {
                  const selected = selectedValues.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => toggle(option.value)}
                      accessibilityRole={props.multiple ? "checkbox" : "radio"}
                      accessibilityState={{ checked: selected }}
                      className="flex-row items-center gap-3 px-4 active:bg-black/5 dark:active:bg-white/10"
                      style={[
                        styles.option,
                        index > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: palette.border,
                        },
                      ]}
                    >
                      <View style={styles.check}>
                        {selected ? (
                          <Monicon name="mdi:check" size={18} color={colors.primary} />
                        ) : null}
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text
                          numberOfLines={2}
                          className={`text-base ${selected ? "font-semibold text-primary" : "text-foreground"}`}
                        >
                          {option.label}
                        </Text>
                        {option.description ? (
                          <Text numberOfLines={1} className="text-xs text-muted-foreground">
                            {option.description}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
                {!options.length ? (
                  <Text className="px-4 py-4 text-center text-muted-foreground">
                    Sin opciones disponibles.
                  </Text>
                ) : null}
              </ScrollView>
              </Animated.View>
            </GlassSurface>
          </Animated.View>
        ) : null}
        </View>
      </Modal>
    </GlassFieldFrame>
  );
}

const styles = StyleSheet.create({
  leadingIcon: {
    marginRight: 10,
  },
  modalRoot: {
    flex: 1,
  },
  menuPosition: {
    position: "absolute",
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.18)",
    borderRadius: 18,
  },
  menu: {
    borderRadius: 18,
    overflow: "hidden",
  },
  menuContent: {
    paddingVertical: 6,
  },
  option: {
    minHeight: OPTION_HEIGHT,
    paddingVertical: 10,
  },
  check: {
    width: 18,
    alignItems: "center",
  },
});
