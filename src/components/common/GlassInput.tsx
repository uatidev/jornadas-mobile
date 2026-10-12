import { THEME } from "@/src/components/ui/lib/theme";
import { useTheme } from "@/src/providers/ThemeProvider";
import Monicon from "@monicon/native";
import { useState, type Ref } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import {
  GlassFieldFrame,
  glassFieldStyles,
  useGlassFieldBoxStyle,
} from "./GlassField";

export type GlassInputType =
  | "text"
  | "textarea"
  | "password"
  | "number"
  | "email"
  | "tel";

export type GlassInputProps = Omit<
  TextInputProps,
  "style" | "multiline" | "secureTextEntry"
> & {
  label?: string;
  type?: GlassInputType;
  /** Marca el campo con * y muestra un error si se deja vacío al salir de él. */
  required?: boolean;
  requiredMessage?: string;
  /** Mensaje cuando un correo (type="email") no tiene un formato válido. */
  invalidEmailMessage?: string;
  /**
   * Máscara de dígitos: cada `9` es un dígito y el resto se inserta tal cual.
   * Con máscara, `onChangeText` recibe solo los dígitos. Por defecto en
   * type="tel": "999 999 9999".
   */
  mask?: string;
  /** Error externo (por ejemplo de react-hook-form). Tiene prioridad. */
  error?: string;
  /** Texto de ayuda debajo del campo (se oculta cuando hay error). */
  helperText?: string;
  /** Texto de ayuda que se abre al tocar el icono ⓘ (arriba a la derecha). */
  help?: string;
  /** Icono Monicon dentro del campo, a la izquierda (debe estar en metro.config.js). */
  leftIcon?: string;
  containerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<TextInput>;
};

const sanitizeNumber = (text: string) => {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const [integer, ...decimals] = cleaned.split(".");
  return decimals.length ? `${integer}.${decimals.join("")}` : integer;
};

const KEYBOARD_BY_TYPE: Partial<Record<GlassInputType, TextInputProps["keyboardType"]>> = {
  number: "decimal-pad",
  email: "email-address",
  tel: "phone-pad",
};

// Autocompletado del sistema (iOS: textContentType; Android/web: autoComplete).
const CONTENT_TYPE_BY_TYPE: Partial<Record<GlassInputType, TextInputProps["textContentType"]>> = {
  email: "emailAddress",
  tel: "telephoneNumber",
  password: "password",
};
const AUTOCOMPLETE_BY_TYPE: Partial<Record<GlassInputType, TextInputProps["autoComplete"]>> = {
  email: "email",
  tel: "tel",
  password: "password",
};

const DEFAULT_TEL_MASK = "999 999 9999";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const onlyDigits = (text: string) => text.replace(/\D/g, "");

/** Aplica la máscara a los dígitos: "9930030032" → "993 003 0032". */
const applyMask = (digits: string, mask: string) => {
  let result = "";
  let index = 0;
  for (const char of mask) {
    if (index >= digits.length) break;
    if (char === "9") {
      result += digits[index];
      index += 1;
    } else {
      result += char;
    }
  }
  return result;
};

/**
 * Campo de texto con estilo vidrio (para usar sobre fondos de color o junto a
 * `GlassSurface`). Soporta text, textarea, password, number, email (teclado de
 * correo + validación de formato) y tel (máscara "993 003 0032").
 */
export function GlassInput({
  label,
  type = "text",
  required = false,
  requiredMessage = "Este campo es obligatorio.",
  invalidEmailMessage = "Ingresa un correo válido, por ejemplo nombre@correo.com.",
  mask,
  error,
  helperText,
  help,
  leftIcon,
  containerStyle,
  ref,
  value,
  onChangeText,
  onFocus,
  onBlur,
  editable = true,
  ...inputProps
}: GlassInputProps) {
  const { colorScheme } = useTheme();
  const palette = THEME[colorScheme];

  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isTextarea = type === "textarea";
  const isPassword = type === "password";
  const isEmail = type === "email";
  const activeMask = mask ?? (type === "tel" ? DEFAULT_TEL_MASK : undefined);
  const maskDigits = activeMask ? activeMask.split("9").length - 1 : 0;
  const rawValue = String(value ?? "");
  const displayValue = activeMask ? applyMask(onlyDigits(rawValue), activeMask) : value;
  const isEmpty = !rawValue.trim();
  const invalidEmail =
    isEmail && touched && !isEmpty && !EMAIL_PATTERN.test(rawValue.trim());
  const message =
    error ||
    (required && touched && isEmpty ? requiredMessage : undefined) ||
    (invalidEmail ? invalidEmailMessage : undefined);
  const hasError = Boolean(message);
  const { colors, boxStyle } = useGlassFieldBoxStyle(focused, hasError);

  const handleFocus: TextInputProps["onFocus"] = (event) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur: TextInputProps["onBlur"] = (event) => {
    setFocused(false);
    setTouched(true);
    onBlur?.(event);
  };

  const handleChangeText = (text: string) => {
    if (activeMask) {
      onChangeText?.(onlyDigits(text).slice(0, maskDigits));
      return;
    }
    if (type === "number") {
      onChangeText?.(sanitizeNumber(text));
      return;
    }
    // Los correos no llevan espacios.
    onChangeText?.(isEmail ? text.replace(/\s/g, "") : text);
  };

  return (
    <GlassFieldFrame
      label={label}
      required={required}
      help={help}
      message={message}
      helperText={helperText}
      containerStyle={containerStyle}
    >
      <Animated.View
        style={[
          glassFieldStyles.box,
          isTextarea && styles.boxTextarea,
          !editable && glassFieldStyles.disabled,
          boxStyle,
        ]}
      >
        {leftIcon && !isTextarea ? (
          <View style={styles.leadingIcon} pointerEvents="none">
            <Monicon
              name={leftIcon}
              size={20}
              color={focused ? colors.primary : palette.mutedForeground}
            />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          value={displayValue}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={editable}
          multiline={isTextarea}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={inputProps.keyboardType ?? KEYBOARD_BY_TYPE[type]}
          textContentType={CONTENT_TYPE_BY_TYPE[type]}
          autoComplete={AUTOCOMPLETE_BY_TYPE[type]}
          autoCorrect={isEmail || isPassword || activeMask ? false : undefined}
          maxLength={activeMask ? activeMask.length : undefined}
          autoCapitalize={
            inputProps.autoCapitalize ??
            (isEmail || isPassword ? "none" : "sentences")
          }
          textAlignVertical={isTextarea ? "top" : "center"}
          placeholderTextColor={palette.mutedForeground}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          aria-invalid={hasError}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          {...inputProps}
          style={[
            styles.input,
            { color: palette.foreground },
            isTextarea && styles.inputTextarea,
          ]}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setShowPassword((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            hitSlop={8}
            style={styles.trailingButton}
          >
            <Monicon
              name={showPassword ? "mdi:eye-off" : "mdi:eye"}
              size={20}
              color={focused ? colors.primary : palette.mutedForeground}
            />
          </Pressable>
        ) : null}
      </Animated.View>
    </GlassFieldFrame>
  );
}

const styles = StyleSheet.create({
  boxTextarea: {
    minHeight: 120,
    alignItems: "stretch",
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontFamily: "Poppins",
    fontSize: 16,
    paddingVertical: 12,
  },
  inputTextarea: {
    paddingVertical: 0,
  },
  leadingIcon: {
    marginRight: 10,
  },
  trailingButton: {
    marginLeft: 8,
    padding: 2,
  },
});
