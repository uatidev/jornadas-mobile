import {
  ChangePasswordModal,
  ChangeProfilePhotoModal,
  DeleteAccountDialog,
  ProfileCard,
  SettingsGroup,
  UpdateNameModal,
} from "@/src/components/modules/gestionar-cuenta";
import { Button } from "@/src/components/ui/button";
import { Switch } from "@/src/components/ui/switch";
import { Text } from "@/src/components/ui/text";
import { useGestionarCuenta } from "@/src/hooks/useGestionarCuenta";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import Monicon from "@monicon/native";
import { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ConfiguracionScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { colorScheme, setThemePreference } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const {
    user,
    showDeleteDialog,
    setShowDeleteDialog,
    showChangeProfilePhotoModal,
    setShowChangeProfilePhotoModal,
    showUpdateNameModal,
    setShowUpdateNameModal,
    showChangePasswordModal,
    setShowChangePasswordModal,
    settingsGroups,
    getInitials,
    getFullName,
    confirmDeleteAccount,
    handleModalSuccess,
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
      <View
        className="border-b border-border px-6 pb-5"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Text className="text-center text-xl font-bold">Configuración</Text>
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          Personaliza la aplicación y administra tu cuenta.
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 28,
        }}
      >
        <View className="mx-auto w-full max-w-[672px] gap-4">
          <ProfileCard user={user} getInitials={getInitials} />

          <View className="overflow-hidden rounded-2xl border border-border bg-card">
            <View className="border-b border-border px-4 py-3">
              <Text className="text-sm font-bold text-muted-foreground">
                APARIENCIA
              </Text>
            </View>
            <View className="flex-row items-center gap-4 px-4 py-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Monicon
                  name={colorScheme === "dark" ? "ic:outline-dark-mode" : "ic:outline-light-mode"}
                  size={22}
                  color="#981646"
                />
              </View>
              <View className="flex-1">
                <Text className="font-semibold">Modo oscuro</Text>
                <Text className="mt-1 text-xs text-muted-foreground">
                  Reduce el brillo y usa colores oscuros.
                </Text>
              </View>
              <Switch
                checked={colorScheme === "dark"}
                onCheckedChange={(checked) => {
                  void setThemePreference(checked ? "dark" : "light");
                }}
              />
            </View>
          </View>

          {settingsGroups.map((group) => (
            <SettingsGroup key={group.id} group={group} />
          ))}

          <View className="rounded-2xl border border-border bg-card p-4">
            <Text className="text-sm font-bold text-muted-foreground">SESIÓN</Text>
            <Text className="mb-4 mt-1 text-xs text-muted-foreground">
              Cierra tu sesión en este dispositivo.
            </Text>
            <Button
              variant="destructive"
              disabled={isLoggingOut}
              onPress={handleLogout}
            >
              {isLoggingOut ? <ActivityIndicator size="small" color="white" /> : null}
              <Text>{isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}</Text>
            </Button>
          </View>
        </View>
      </ScrollView>

      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDeleteAccount}
      />
      <ChangeProfilePhotoModal
        open={showChangeProfilePhotoModal}
        onOpenChange={setShowChangeProfilePhotoModal}
        onSuccess={handleModalSuccess}
      />
      <UpdateNameModal
        open={showUpdateNameModal}
        onOpenChange={setShowUpdateNameModal}
        currentName={getFullName()}
        onSuccess={handleModalSuccess}
      />
      <ChangePasswordModal
        open={showChangePasswordModal}
        onOpenChange={setShowChangePasswordModal}
        onSuccess={handleModalSuccess}
      />
    </View>
  );
}
