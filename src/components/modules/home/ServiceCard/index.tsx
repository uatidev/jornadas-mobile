import { THEME } from "@/src/components/ui/lib/theme";
import { useTheme } from "@/src/providers/ThemeProvider";
import type { ProcedureService, ServiceType } from "@/src/types/catalog";
import { Monicon } from "@monicon/native";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type ServiceStatus = "open" | "upcoming" | "closed";

export const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  open: "Abierto",
  upcoming: "Próximo",
  closed: "Cerrado",
};

export const SERVICE_STATUS_DOT_COLOR: Record<ServiceStatus, string> = {
  open: "#10b981",
  upcoming: "#f59e0b",
  closed: "#a1a1aa",
};

const STATUS_TEXT_CLASS: Record<ServiceStatus, string> = {
  open: "text-emerald-700 dark:text-emerald-400",
  upcoming: "text-amber-700 dark:text-amber-400",
  closed: "text-muted-foreground",
};

const TYPE_LABEL: Record<ServiceType, string> = {
  tramite: "Trámite",
  servicio: "Servicio",
  programa: "Programa",
};

/** Estado de un trámite/servicio según su ventana de apertura. */
export function getServiceStatus(
  service: ProcedureService,
  now: number = Date.now(),
): ServiceStatus {
  const opensAt = service.opensAt ? new Date(service.opensAt).getTime() : null;
  const closesAt = service.closesAt ? new Date(service.closesAt).getTime() : null;

  if (
    service.active &&
    (opensAt === null || now >= opensAt) &&
    (closesAt === null || now <= closesAt)
  ) {
    return "open";
  }
  return opensAt !== null && opensAt > now ? "upcoming" : "closed";
}

type ServiceCardProps = {
  service: ProcedureService;
  status: ServiceStatus;
  disabled?: boolean;
  onPress: () => void;
};

export function ServiceCard({
  service,
  status,
  disabled = false,
  onPress,
}: ServiceCardProps) {
  const { colorScheme } = useTheme();
  const primary = THEME[colorScheme].primary;
  const typeLabel = TYPE_LABEL[service.type] ?? service.type;

  return (
    <Pressable
      className="bg-card active:opacity-70 dark:border dark:border-border"
      style={styles.card}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel}: ${service.name}. ${SERVICE_STATUS_LABEL[status]}`}
    >
      <View style={styles.body}>
        <Text
          numberOfLines={1}
          className="font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          {typeLabel}
        </Text>
        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          className="font-sans text-base font-semibold leading-5 text-foreground"
        >
          {service.name}
        </Text>
        <View style={styles.statusRow}>
          <View
            style={[styles.statusDot, { backgroundColor: SERVICE_STATUS_DOT_COLOR[status] }]}
          />
          <Text className={`font-sans text-xs font-medium ${STATUS_TEXT_CLASS[status]}`}>
            {SERVICE_STATUS_LABEL[status]}
          </Text>
        </View>
      </View>

      <Monicon name="ci:chevron-right" size={22} color={primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.07)",
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
