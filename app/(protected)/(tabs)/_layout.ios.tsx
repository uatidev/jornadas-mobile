import { useAuth } from "@/src/providers/AuthProvider";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS } from "react-native";

const adaptiveForeground = DynamicColorIOS({
  light: "#6f1237",
  dark: "#ffffff",
});

export default function IosTabsLayout() {
  const { user } = useAuth();
  const canSeeSecretaryTab =
    user?.role === "secretaria" ||
    user?.role === "capturista_secretaria" ||
    user?.role === "enlace";

  return (
    <NativeTabs
      tintColor={adaptiveForeground}
      labelStyle={{ color: adaptiveForeground }}
    >
      <NativeTabs.Trigger name="home/index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
        />
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="mis-solicitudes/index">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "list.bullet.clipboard",
            selected: "list.bullet.clipboard.fill",
          }}
        />
        <NativeTabs.Trigger.Label>Mis solicitudes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {canSeeSecretaryTab ? (
        <NativeTabs.Trigger name="secretaria/index">
          <NativeTabs.Trigger.Icon
            sf={{ default: "doc.text", selected: "doc.text.fill" }}
          />
          <NativeTabs.Trigger.Label>Secretaria</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ) : null}

      <NativeTabs.Trigger name="configuracion/index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
        />
        <NativeTabs.Trigger.Label>Configuración</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
