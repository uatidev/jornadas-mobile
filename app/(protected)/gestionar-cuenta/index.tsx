import {
  DeleteAccountDialog,
  GestionarCuentaHeader,
  ProfileCard,
  SettingsGroup,
} from "@/src/components/modules/gestionar-cuenta";
import { THEME } from "@/src/components/ui/lib/theme";
import { useGestionarCuenta } from "@/src/hooks/useGestionarCuenta";
import { useTheme } from "@/src/providers/ThemeProvider";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GestionarCuentaScreen() {
  const { colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    user,
    showDeleteDialog,
    setShowDeleteDialog,
    settingsGroups,
    getInitials,
    confirmDeleteAccount,
  } = useGestionarCuenta();

  const backgroundColor = THEME[colorScheme].background;

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor,
        paddingTop: insets.top,
      }}
    >
      <GestionarCuentaHeader />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
      >
        <View className="mb-3">
          <ProfileCard user={user} getInitials={getInitials} />
        </View>

        <View style={{ gap: 20 }}>
          {settingsGroups.map((group) => (
            <SettingsGroup key={group.id} group={group} />
          ))}
        </View>
      </ScrollView>

      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDeleteAccount}
      />



    </View>
  );
}
