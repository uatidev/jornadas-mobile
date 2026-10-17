import { GlassTabBar } from "@/src/components/common/GlassTabBar";
import { useAuth } from "@/src/providers/AuthProvider";
import { REPORTS_ROLES } from "@/src/constants/reportes";
import Monicon from "@monicon/native";
import { Tabs, useRouter } from "expo-router";
import { Platform, useWindowDimensions } from "react-native";

export default function TabsLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hideTabBar = Platform.OS === "web" && width >= 900;
  // Botón flotante (abre Atención de Secretaría): Secretaría, Enlace de canalización, Representante de la
  // Titular y Superadministrador. El resto ve solo la barra de pestañas.
  const canUseQuickAction =
    user?.role === "secretaria" ||
    user?.role === "enlace" ||
    user?.role === "capturista_secretaria" ||
    user?.role === "super_admin";
  const canViewReports = !!user?.role && REPORTS_ROLES.includes(user.role);

  return (
    <Tabs
      initialRouteName="home/index"
      tabBar={(props) => (
        <GlassTabBar
          {...props}
          hidden={hideTabBar}
          actionIcon="ci:file-document"
          actionAccessibilityLabel="Atención de Secretaría"
          onActionPress={
            canUseQuickAction
              ? () => router.push("/secretary-requests")
              : undefined
          }
        />
      )}
      screenOptions={{
        headerShown: false,
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
        name="reportes/index"
        options={{
          title: "Reportes",
          // Solo Superadministrador y Secretaría ven la pestaña.
          href: canViewReports ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Monicon name="ci:chart-pie" size={size || 24} color={color} />
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
              name="mdi:finance"
              size={size || 24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
