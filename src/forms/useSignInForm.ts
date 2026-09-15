import { useAuth } from "@/src/providers/AuthProvider";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Platform, type TextInput } from "react-native";
import { SignInFormData, signInValidationSchema } from "./schemas/SignInForm";

export const useSignInForm = () => {
  const router = useRouter();
  const { login } = useAuth();
  const passwordInputRef = useRef<TextInput>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: yupResolver(signInValidationSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: SignInFormData) => {
      setError(null);
      return login(data.email, data.password);
    },
    onSuccess: (user) => {
      const opensAdministrativePanel =
        Platform.OS === "web" &&
        (user.role === "super_admin" ||
          user.role === "gestor" ||
          user.role === "enlace" ||
          user.role === "secretaria");
      router.replace(
        opensAdministrativePanel
          ? ("/(protected)/admin" as any)
          : ("/(protected)/(tabs)/home" as any),
      );
    },
    onError: (error: any) => {
      console.error("Error en login:", error);
      const rawMessage = error?.message || "";
      const errorMessage = /rate limit|too many requests|exceeded/i.test(rawMessage)
        ? "Se alcanzó el límite de intentos de inicio de sesión para este correo. Espera antes de volver a intentarlo y verifica tu contraseña."
        : rawMessage ||
          "Error al iniciar sesión. Por favor intenta nuevamente.";
      setError(errorMessage);
    },
  });

  const onSubmit = (data: SignInFormData) => {
    mutation.mutate(data);
  };

  const onEmailSubmitEditing = () => {
    passwordInputRef.current?.focus();
  };

  return {
    control,
    handleSubmit: handleSubmit(onSubmit),
    errors,
    error,
    passwordInputRef,
    showPassword,
    setShowPassword,
    onEmailSubmitEditing,
    isLoading: mutation.isPending,
  };
};
