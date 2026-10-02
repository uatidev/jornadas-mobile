import { SignInForm } from "@/src/components/modules/auth/sign-in";
import { THEME } from "@/src/components/ui/lib/theme";
import { useTheme } from "@/src/providers/ThemeProvider";
import React from "react";
import {
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function LoginScreen() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const content = (
    <View
      className="h-screen sm:flex-1 items-center justify-center p-4 py-8 sm:py-4 sm:p-6"
      style={{ flex: 1, backgroundColor: THEME[colorScheme].background }}
    >
      {/* Mosaico del patrón repetido a tamaño real (sin escalar) para que se vea nítido.
          En modo claro se tiñe de guinda para que se note sobre el fondo blanco */}
      <Image
        source={require("@/src/assets/images/background-tile.png")}
        resizeMode="repeat"
        className="absolute top-0 left-0"
        style={{
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          tintColor: isDark ? "#ffffff" : "#9A1445",
          opacity: isDark ? 0.05 : Platform.OS === "web" ? 0.1 : 0.06,
        }}
      />
      <SignInForm />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {Platform.OS === "web" ? (
        content
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          {content}
        </TouchableWithoutFeedback>
      )}
    </KeyboardAvoidingView>
  );
}
