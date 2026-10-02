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
import { useForgotPasswordForm } from "@/src/forms/useForgotPasswordForm";
import { Monicon } from "@monicon/native";
import { AlertCircleIcon, CheckCircleIcon } from "lucide-react-native";
import { Link } from "expo-router";
import { useTheme } from "@/src/providers/ThemeProvider";
import { Controller } from "react-hook-form";
import {
  Image,
  View,
} from "react-native";

export function ForgotPasswordForm() {
  const {
    control,
    handleSubmit,
    errors,
    error,
    success,
    isLoading,
  } = useForgotPasswordForm();
  const { colorScheme } = useTheme();
  const logoSource =
    colorScheme === "dark"
      ? require("@/src/assets/images/logo-ac-color-vert-blanco.png")
      : require("@/src/assets/images/logo-ac-color-vert.png");

  if (success) {
    return (
      <View className="gap-6 bg-primary">
        <Card className="backdrop-blur-3xl border-border/0 sm:border-border shadow-none sm:shadow-sm sm:shadow-black/5">
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
              Correo enviado
            </CardTitle>
            <CardDescription className="text-center sm:text-left">
              Revisa tu bandeja de entrada
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-6">
            <Alert icon={CheckCircleIcon} className="mb-4">
              <AlertTitle>Correo enviado exitosamente</AlertTitle>
              <AlertDescription>
                Hemos enviado un correo electrónico con las instrucciones para
                restablecer tu contraseña. Por favor revisa tu bandeja de
                entrada y sigue los pasos indicados.
              </AlertDescription>
            </Alert>
            <View className="flex-row justify-center items-center gap-1">
              <Text className="text-sm text-muted-foreground">
                ¿Recordaste tu contraseña?
              </Text>
              <Link href="/(auth)/login" asChild>
                <Text className="text-sm text-primary font-medium">
                  Inicia sesión
                </Text>
              </Link>
            </View>
          </CardContent>
        </Card>
      </View>
    );
  }

  return (
    <View className="gap-6 bg-primary">
      <Card className="backdrop-blur-3xl border-border/0 sm:border-border shadow-none sm:shadow-sm sm:shadow-black/5">
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
            Recuperar contraseña
          </CardTitle>
          <CardDescription className="text-center sm:text-left">
            Ingresa tu correo electrónico y te enviaremos las instrucciones para
            restablecer tu contraseña
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          {error && (
            <Alert
              variant="destructive"
              icon={AlertCircleIcon}
              className="mb-4"
            >
              <AlertTitle>Error</AlertTitle>
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
                    returnKeyType="send"
                    onSubmitEditing={handleSubmit}
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
            <Button
              className="w-full"
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text>
                {isLoading ? "Enviando..." : "Enviar correo de recuperación"}
              </Text>
            </Button>
            <View className="flex-row justify-center items-center gap-1">
              <Text className="text-sm text-muted-foreground">
                ¿Recordaste tu contraseña?
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
    </View>
  );
}

