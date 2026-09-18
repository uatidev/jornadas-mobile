import { DynamicColorIOS } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";

const adaptiveForeground = DynamicColorIOS({
  light: "#6f1237",
  dark: "#ffffff",
});

export default function IosTabsLayout() {
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

      <NativeTabs.Trigger name="secretaria/index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "doc.text", selected: "doc.text.fill" }}
        />
        <NativeTabs.Trigger.Label>Secretaría</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="configuracion/index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
        />
        <NativeTabs.Trigger.Label>Configuración</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
