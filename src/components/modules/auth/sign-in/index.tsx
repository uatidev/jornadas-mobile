import { GlassInput } from "@/src/components/common/GlassInput";
import { GlassSurface } from "@/src/components/common/GlassSurface";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/src/components/ui/card";
import { Text } from "@/src/components/ui/text";
import { useSignInForm } from "@/src/forms/useSignInForm";
import { AlertCircleIcon } from "lucide-react-native";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Controller } from "react-hook-form";
import { Image, StyleSheet, View } from "react-native";

export function SignInForm() {
  const {
    control,
    handleSubmit,
    errors,
    error,
    passwordInputRef,
    onEmailSubmitEditing,
    isLoading,
  } = useSignInForm();
  const { colorScheme } = useTheme();
  const logoSource =
    colorScheme === "dark"
      ? require("@/src/assets/images/logo-ac-color-vert-blanco.png")
      : require("@/src/assets/images/logo-ac-color-vert.png");

  return (
    <View className="gap-6 w-full max-w-md">
      <GlassSurface colorScheme={colorScheme} style={styles.glassCard}>
      <Card className="w-full border-0 bg-transparent shadow-none">
        <CardHeader>
          <Image
            source={logoSource}
            style={{
              width: 180,
              height: 180,
              alignSelf: "center",
            }}
            resizeMode="contain"
          />
          <CardTitle className="text-center text-xl sm:text-left">
            Inicia sesión en tu cuenta
          </CardTitle>
          {/* <CardDescription className="text-center sm:text-left">
            Por favor inicia sesión para continuar
          </CardDescription> */}
        </CardHeader>
        <CardContent className="gap-6">
          {error && (
            <Alert
              variant="destructive"
              icon={AlertCircleIcon}
              className="mb-4"
            >
              <AlertTitle>Error al iniciar sesión</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <View className="gap-6">
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <GlassInput
                  label="Correo electrónico"
                  type="email"
                  required
                  placeholder="ejemplo@correo.com"
                  autoComplete="email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={onEmailSubmitEditing}
                  returnKeyType="next"
                  submitBehavior="submit"
                  error={errors.email?.message}
                  help="Usa el correo con el que te dieron de alta en la plataforma."
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <GlassInput
                  ref={passwordInputRef}
                  label="Contraseña"
                  type="password"
                  required
                  placeholder="Ingresa tu contraseña"
                  autoComplete="password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                  error={errors.password?.message}
                />
              )}
            />
            {/* <View className="flex-row justify-end">
              <Link href="/(auth)/forgot-password" asChild>
                <Text className="text-sm text-primary font-medium">
                  ¿Olvidaste tu contraseña?
                </Text>
              </Link>
            </View> */}
            <Button
              className="w-full"
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text>{isLoading ? "Iniciando sesión..." : "Continuar"}</Text>
            </Button>
            {/* <View className="flex-row justify-center items-center gap-1">
              <Text className="text-sm text-muted-foreground">
                ¿No tienes una cuenta?
              </Text>
              <Link href="/(auth)/sign-up" asChild>
                <Text className="text-sm text-primary font-medium">
                  Regístrate
                </Text>
              </Link>
            </View> */}
          </View>
        </CardContent>
      </Card>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    width: "100%",
    borderRadius: 28,
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.18)",
  },
});
