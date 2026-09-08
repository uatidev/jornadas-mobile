import { THEME } from "@/src/components/ui/lib/theme";
import { useTheme } from "@/src/providers/ThemeProvider";
import Monicon from "@monicon/native";
import { Tabs } from "expo-router";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const { colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const hideTabBar = Platform.OS === "web" && width >= 900;
  const backgroundColor = THEME[colorScheme].background;
  const borderColor = THEME[colorScheme].border;
  const iconColor = THEME[colorScheme].foreground;
  const activeIconColor = THEME[colorScheme].primary;

  return (
    <Tabs
      initialRouteName="home/index"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: hideTabBar ? "none" : "flex",
          backgroundColor,
          borderTopColor: borderColor,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingTop: 8,
        },
        tabBarActiveTintColor: activeIconColor,
        tabBarInactiveTintColor: iconColor,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => (
            <Monicon
              name="material-symbols:home-outline-rounded"
              size={size || 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="mis-solicitudes/index"
        options={{
          title: "Mis Solicitudes",
          tabBarIcon: ({ color, size }) => (
            <Monicon
              name="material-symbols:list-alt-check-outline"
              size={size || 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="configuracion/index"
        options={{
          title: "Configuración",
          tabBarIcon: ({ color, size }) => (
            <Monicon
              name="material-symbols:settings-outline-rounded"
              size={size || 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="desarrollo-comercial/index"
        options={{
          title: "Desarrollo Comercial",
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Monicon
              name="ic:outline-business"
              size={size || 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="desarrollo-turistico/index"
        options={{
          title: "Desarrollo Turístico",
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Monicon name="ic:outline-tour" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ferias-festivales/index"
        options={{
          title: "Ferias y Festivales",
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Monicon name="ic:outline-event" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="impulso-inversiones/index"
        options={{
          title: "Impulso de Inversiones",
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Monicon
              name="ic:outline-investment"
              size={size || 24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
