import { useAuth } from "@/src/providers/AuthProvider";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Image, Platform, View } from "react-native";

const Splash = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      // Pequeño delay para mostrar el splash
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          router.replace(
            Platform.OS === "web" && (user?.role === "super_admin" ||
            user?.role === "gestor" ||
            user?.role === "enlace" ||
            user?.role === "secretaria")
              ? ("/(protected)/admin" as any)
              : "/(protected)/(tabs)/home",
          );
        } else {
          router.replace("/(auth)/login");
        }
      }, 1500); // Mostrar splash por 1.5 segundos

      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, user?.role, router]);

  return (
    <View
      style={{
        backgroundColor: "#9A1445",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 288,
          height: "75%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={require("@/src/assets/images/JORNADAS_Vblanco.png")}
          style={{
            width: "100%",
            height: 176,
            resizeMode: "contain",
          }}
        />
      </View>
      <View style={{ height: "25%", justifyContent: "center" }}>
        <ActivityIndicator size={64} color="white" />
      </View>
    </View>
  );
};

export default Splash;
