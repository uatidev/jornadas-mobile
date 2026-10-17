import {
  DeleteAccountDialog,
  ProfileCard,
  SettingsCard,
  SettingsGroup,
  SettingsRow,
} from "@/src/components/modules/gestionar-cuenta";
import { Switch } from "@/src/components/ui/switch";
import { THEME } from "@/src/components/ui/lib/theme";
import { Text } from "@/src/components/ui/text";
import { useGestionarCuenta } from "@/src/hooks/useGestionarCuenta";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { CollapsingHeaderScrollView } from "@/src/components/common/CollapsingHeader";
import { useGlassTabBarSpace } from "@/src/components/common/GlassTabBar";

const APP_VERSION =
  process.env.EXPO_PUBLIC_APP_VERSION || Constants.expoConfig?.version || "—";

export default function ConfiguracionScreen() {
  const tabBarSpace = useGlassTabBarSpace();
  const router = useRouter();
  const { logout } = useAuth();
  const { colorScheme, setThemePreference } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const {
    user,
    showDeleteDialog,
    setShowDeleteDialog,
    settingsGroups,
    getInitials,
    confirmDeleteAccount,
  } = useGestionarCuenta();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      {/* Degradado de fondo: color primario arriba, fondo (blanco) abajo. */}
      <LinearGradient
        colors={[THEME[colorScheme].primary, THEME[colorScheme].background]}
        locations={[0, 0.45]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <CollapsingHeaderScrollView
        title="Configuración"
        subtitle="Personaliza la aplicación y administra tu cuenta."
        largeTitleAlign="center"
        largeTitleClassName="text-white"
        subtitleClassName="text-white/80"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: tabBarSpace + 12,
        }}
      >
        <View className="mx-auto w-full max-w-[672px]" style={{ gap: 20 }}>
          <ProfileCard user={user} getInitials={getInitials} />

          <SettingsCard title="Apariencia">
            <SettingsRow
              icon={colorScheme === "dark" ? "ic:outline-dark-mode" : "ic:outline-light-mode"}
              title="Modo oscuro"
              description="Reduce el brillo y usa colores oscuros."
              isLast
              right={
                <Switch
                  checked={colorScheme === "dark"}
                  onCheckedChange={(checked) => {
                    void setThemePreference(checked ? "dark" : "light");
                  }}
                />
              }
            />
          </SettingsCard>

          <SettingsCard title="Ayuda">
            <SettingsRow
              icon="mdi:information-outline"
              title="Guía de un trámite de ejemplo"
              description="Recorre paso a paso cómo se registra una solicitud. No se envía nada."
              onPress={() => router.push("/guia-tramite")}
              isLast
            />
          </SettingsCard>

          {settingsGroups.map((group) => (
            <SettingsGroup key={group.id} group={group} />
          ))}

          <SettingsCard title="Sesión">
            <SettingsRow
              icon="ic:outline-logout"
              title={isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
              description="Cierra tu sesión en este dispositivo."
              destructive
              loading={isLoggingOut}
              onPress={handleLogout}
              isLast
            />
          </SettingsCard>
          <Text className="text-center text-xs text-muted-foreground">{`Versión ${APP_VERSION}`}</Text>
        </View>
      </CollapsingHeaderScrollView>

      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDeleteAccount}
      />
    </View>
  );
}
