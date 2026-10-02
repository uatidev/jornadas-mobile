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
import { useResetPasswordForm } from "@/src/forms/useResetPasswordForm";
import { Monicon } from "@monicon/native";
import { AlertCircleIcon } from "lucide-react-native";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Controller } from "react-hook-form";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

interface ResetPasswordFormProps {
  userId: string;
  secret: string;
}

export function ResetPasswordForm({ userId, secret }: ResetPasswordFormProps) {
  const {
    control,
    handleSubmit,
    errors,
    error,
    passwordInputRef,
    confirmPasswordInputRef,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    onPasswordSubmitEditing,
    isLoading,
  } = useResetPasswordForm({ userId, secret });
  const { colorScheme } = useTheme();
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
            Restablecer contraseña
          </CardTitle>
          <CardDescription className="text-center sm:text-left">
            Ingresa tu nueva contraseña
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          {error && (
            <Alert
              variant="destructive"
              icon={AlertCircleIcon}
              className="mb-4"
            >
              <AlertTitle>Error al restablecer contraseña</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <View className="gap-6">
            <View className="gap-1.5">
              <Label htmlFor="password">Nueva Contraseña</Label>
              <View style={{ position: "relative" }}>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      ref={passwordInputRef}
                      id="password"
                      placeholder="Ingresa tu nueva contraseña"
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
                      placeholder="Confirma tu nueva contraseña"
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
              <Text>
                {isLoading ? "Restableciendo..." : "Restablecer contraseña"}
              </Text>
            </Button>
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

