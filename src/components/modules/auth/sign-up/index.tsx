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
import { THEME } from "@/src/components/ui/lib/theme";
import { Text } from "@/src/components/ui/text";
import { useSignUpForm } from "@/src/forms/useSignUpForm";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Monicon } from "@monicon/native";
import { AlertCircleIcon } from "lucide-react-native";
import { Link } from "expo-router";
import { Controller } from "react-hook-form";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export function SignUpForm() {
  const {
    control,
    handleSubmit,
    errors,
    error,
    emailInputRef,
    passwordInputRef,
    confirmPasswordInputRef,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    onEmailSubmitEditing,
    onPasswordSubmitEditing,
    isLoading,
  } = useSignUpForm();
  const { colorScheme } = useTheme();
  const primaryColor = THEME[colorScheme].primary;
  const logoSource =
    colorScheme === "dark"
      ? require("@/src/assets/images/logo-ac-color-vert-blanco.png")
      : require("@/src/assets/images/logo-ac-color-vert.png");

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
            Crea tu cuenta
          </CardTitle>
          <CardDescription className="text-center sm:text-left">
            Completa el formulario para registrarte
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          {error && (
            <Alert
              variant="destructive"
              icon={AlertCircleIcon}
              className="mb-4"
            >
              <AlertTitle>Error al registrarse</AlertTitle>
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
                    ref={emailInputRef}
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
                      onSubmitEditing={onPasswordSubmitEditing}
                      returnKeyType="next"
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
            <View className="gap-1.5">
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <View style={{ position: "relative" }}>
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      ref={confirmPasswordInputRef}
                      id="confirmPassword"
                      placeholder="Confirma tu contraseña"
                      secureTextEntry={!showConfirmPassword}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      returnKeyType="send"
                      onSubmitEditing={handleSubmit}
                      className={`pr-12 ${errors.confirmPassword ? "border-destructive" : ""}`}
                    />
                  )}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Monicon
                    name={showConfirmPassword ? "mdi:eye-off" : "mdi:eye"}
                    size={20}
                    color="#981646"
                  />
                </Pressable>
              </View>
              {errors.confirmPassword && (
                <Text className="text-destructive text-sm">
                  {errors.confirmPassword.message}
                </Text>
              )}
            </View>
            <Button
              className="w-full"
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text>{isLoading ? "Registrando..." : "Registrarse"}</Text>
            </Button>
            <View className="flex-row justify-center items-center gap-1">
              <Text className="text-sm text-muted-foreground">
                ¿Ya tienes una cuenta?
              </Text>
              <Link href="/(auth)/login" asChild>
                <Text className="text-sm text-primary font-medium">
                  Inicia sesión
                </Text>
              </Link>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* Loading overlay durante el registro */}
      <Modal
        visible={isLoading}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="items-center">
            <ActivityIndicator size="large" color={primaryColor} />
            <Text className="mt-4 text-[15px] font-medium text-white">
              Creando cuenta...
            </Text>
          </View>
        </View>
      </Modal>
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

