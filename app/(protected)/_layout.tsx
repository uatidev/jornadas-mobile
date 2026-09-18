import { useAuth } from "@/src/providers/AuthProvider";
import { Redirect, Stack } from "expo-router";

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="promocion-turistica"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="economia-social" options={{ headerShown: false }} />
        <Stack.Screen
          name="impulso-inversiones"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="agregar-seguimiento"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="fondos-financiamiento"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="gestionar-cuenta"
          options={{ headerShown: false }}
        />
        {/* NUEVA RUTA */}
        <Stack.Screen
          name="new-request"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="secretary-requests" options={{ headerShown: false }} />
    </Stack>
  );
}
