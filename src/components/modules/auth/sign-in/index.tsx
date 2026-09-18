import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Text } from "@/src/components/ui/text";
import { useSignInForm } from "@/src/forms/useSignInForm";
import { Monicon } from "@monicon/native";
import { AlertCircleIcon } from "lucide-react-native";
import { Controller } from "react-hook-form";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";

export function SignInForm() {
  const {
    control,
    handleSubmit,
    errors,
    error,
    passwordInputRef,
    showPassword,
    setShowPassword,
    onEmailSubmitEditing,
    isLoading,
  } = useSignInForm();
  const colorScheme = useColorScheme();
  const logoSource =
    colorScheme === "dark"
      ? require("@/src/assets/images/JORNADAS_V_LETRASB.png")
      : require("@/src/assets/images/logo-vertical-color.png");

  return (
    <View className="gap-6 bg-primary w-full max-w-md">
      <Card className="backdrop-blur-3xl border-border/0 sm:border-border shadow-none sm:shadow-sm sm:shadow-black/5 w-full">
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
          <CardDescription className="text-center sm:text-left">
            Bienvenido de nuevo! Por favor inicia sesión para continuar
          </CardDescription>
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
            <View className="gap-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    id="email"
                    placeholder="ejemplo@correo.com"
                    keyboardType="email-address"
                    autoComplete="email"
                    autoCapitalize="none"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onSubmitEditing={onEmailSubmitEditing}
                    returnKeyType="next"
                    submitBehavior="submit"
                    className={errors.email ? "border-destructive" : ""}
                  />
                )}
              />
              {errors.email && (
                <Text className="text-destructive text-sm">
                  {errors.email.message}
                </Text>
              )}
            </View>
            <View className="gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <View style={{ position: "relative" }}>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      ref={passwordInputRef}
                      id="password"
                      placeholder="Ingresa tu contraseña"
                      secureTextEntry={!showPassword}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      returnKeyType="send"
                      onSubmitEditing={handleSubmit}
                      className={`pr-12 ${errors.password ? "border-destructive" : ""}`}
                    />
                  )}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Monicon
                    name={showPassword ? "mdi:eye-off" : "mdi:eye"}
                    size={20}
                    color="#981646"
                  />
                </Pressable>
              </View>
              {errors.password && (
                <Text className="text-destructive text-sm">
                  {errors.password.message}
                </Text>
              )}
            </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  eyeButton: {
    position: "absolute",
    right: 8,
    top: "40%",
    transform: [{ translateY: -10 }],
    padding: 4,
    zIndex: 1,
  },
});
