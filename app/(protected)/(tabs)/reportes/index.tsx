import { CollapsingHeaderScrollView } from "@/src/components/common/CollapsingHeader";
import { GlassIconButton } from "@/src/components/common/GlassIconButton";
import { GlassSelect } from "@/src/components/common/GlassSelect";
import { useGlassTabBarSpace } from "@/src/components/common/GlassTabBar";
import {
  ChartCard,
  DonutChart,
  ReportCard,
  HorizontalBarChart,
  SPLIT_SERIES,
  StackedBarChart,
  useChartColors,
} from "@/src/components/modules/reportes/ReportCharts";
import { Button } from "@/src/components/ui/button";
import { Text } from "@/src/components/ui/text";
import { REPORT_SECTIONS, REPORTS_ROLES } from "@/src/constants/reportes";
import { useReportes, type ReportEvent, type ReportKind } from "@/src/hooks/useReportes";
import { useAuth } from "@/src/providers/AuthProvider";
import { formatEventRange, type EventStatus } from "@/src/utils/eventStatus";
import { exportReportPdf } from "@/src/utils/reportPdf";
import Monicon from "@monicon/native";
import { Redirect } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";

const ALL_EVENTS = "__all";

const KIND_FILTERS: { value: ReportKind; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "regular", label: "Trámites" },
  { value: "secretary", label: "Atención de Secretaría" },
];

const STATUS_BADGE: Record<EventStatus, { container: string; text: string }> = {
  Activo: { container: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400" },
  Programado: { container: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-400" },
  Finalizado: { container: "bg-muted", text: "text-muted-foreground" },
};

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ paddingInline: 12 }}
      className={`h-8 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary" : "border-border bg-card"}`}
    >
      <Text className={`text-xs font-semibold ${selected ? "text-white" : "text-muted-foreground"}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * Resumen en una sola tarjeta: el total se desglosa por tipo de solicitud y,
 * aparte, cuántas personas capturaron (no es otro tipo de solicitud).
 */
function SummaryCard({ total, regular, secretary, capturistas, action }: {
  total: number;
  regular: number;
  secretary: number;
  capturistas: number;
  /** Acción en la esquina superior derecha (exportar). */
  action?: ReactNode;
}) {
  const colors = useChartColors();
  const types = SPLIT_SERIES.map((serie) => ({
    ...serie,
    value: serie.key === "regular" ? regular : secretary,
    hint: REPORT_SECTIONS.summary.hints[serie.key],
  }));

  return (
    <ReportCard className="p-5">
      <View className="flex-row items-start justify-between gap-3">
        <View>
          <Text className="text-xs text-muted-foreground">{REPORT_SECTIONS.summary.title}</Text>
          <Text className="mt-1 text-4xl font-bold text-foreground">{total.toLocaleString("es-MX")}</Text>
        </View>
        {action}
      </View>
      <View className="mt-5 gap-4">
        {types.map((type) => (
          <View key={type.key} className="flex-row items-start gap-3">
            <View
              style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: colors.series[type.colorIndex] }}
            />
            <View className="flex-1 gap-0.5">
              <Text className="text-sm text-foreground">{type.label}</Text>
              <Text className="text-xs leading-4 text-muted-foreground">{type.hint}</Text>
            </View>
            <Text className="text-base font-semibold text-foreground">{type.value.toLocaleString("es-MX")}</Text>
          </View>
        ))}
      </View>
      <View className="mt-5 flex-row items-center gap-2 rounded-2xl bg-muted px-3 py-3">
        <Monicon name="ci:users-group" size={18} color={colors.primary} />
        <Text className="flex-1 text-sm text-foreground">
          Capturadas por <Text className="font-semibold text-foreground">{capturistas}</Text>{" "}
          {capturistas === 1 ? "persona" : "personas"}
        </Text>
      </View>
    </ReportCard>
  );
}

function EventStatusBadge({ status }: { status: EventStatus }) {
  const tone = STATUS_BADGE[status];
  return (
    <View className={`rounded-full px-2.5 py-1 ${tone.container}`}>
      <Text className={`text-[11px] font-semibold ${tone.text}`}>{status}</Text>
    </View>
  );
}

function EventInfoCard({ event }: { event: ReportEvent }) {
  const colors = useChartColors();
  const venue = [event.venue, event.address]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(" · ");
  const rows = [
    { icon: "ci:map", text: [event.municipality, event.locality].filter(Boolean).join(" · ") },
    { icon: "ci:building-03", text: venue },
    { icon: "ci:calendar-event", text: formatEventRange(event) },
  ].filter((row) => row.text);

  return (
    <ReportCard className="p-4">
      <View className="flex-row items-start gap-2">
        <Text className="flex-1 text-base font-semibold text-foreground">{event.name}</Text>
        <EventStatusBadge status={event.status} />
      </View>
      {event.folioPrefix ? (
        <Text className="mt-0.5 text-xs text-muted-foreground">Folio {event.folioPrefix}</Text>
      ) : null}
      <View className="mt-3 gap-2">
        {rows.map((row) => (
          <View key={row.icon} className="flex-row items-center gap-2">
            <Monicon name={row.icon} size={16} color={colors.primary} />
            <Text className="flex-1 text-sm text-foreground">{row.text}</Text>
          </View>
        ))}
      </View>
      {event.notes ? <Text className="mt-3 text-xs text-muted-foreground">{event.notes}</Text> : null}
    </ReportCard>
  );
}

export default function ReportesScreen() {
  const { user } = useAuth();
  const tabBarSpace = useGlassTabBarSpace();
  const [eventId, setEventId] = useState(ALL_EVENTS);
  const [kind, setKind] = useState<ReportKind>("all");
  const [exporting, setExporting] = useState(false);
  const reportes = useReportes(eventId === ALL_EVENTS ? "" : eventId, kind);
  const { report } = reportes;

  if (!user?.role || !REPORTS_ROLES.includes(user.role)) {
    return <Redirect href="/home" />;
  }

  const onExport = async () => {
    setExporting(true);
    try {
      await exportReportPdf({
        report,
        event: reportes.selectedEvent,
        kind,
        exportedBy: [user.nombre, user.primerApellido, user.segundoApellido].filter(Boolean).join(" ") || user.email,
      });
    } catch (error) {
      Alert.alert("No se pudo exportar", error instanceof Error ? error.message : "Intenta de nuevo.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <CollapsingHeaderScrollView
        title="Reportes"
        subtitle="Indicadores de las solicitudes capturadas por evento."
        largeTitleAlign="center"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: tabBarSpace + 8,
        }}
        refreshControl={
          <RefreshControl refreshing={reportes.isRefetching} onRefresh={() => reportes.refetch()} />
        }
      >
        <GlassSelect
          leftIcon="ci:calendar-event"
          placeholder="Selecciona un evento"
          options={[
            { value: ALL_EVENTS, label: "Todos los eventos", description: `${reportes.events.length} eventos registrados` },
            ...reportes.events.map((event) => ({
              value: event.id,
              label: event.name,
              description: `${event.status} · ${event.municipality} · ${event.requestCount} solicitudes`,
            })),
          ]}
          value={eventId}
          onChange={setEventId}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4 mt-3"
          contentContainerStyle={{ gap: 8 }}
        >
          {KIND_FILTERS.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              selected={kind === filter.value}
              onPress={() => setKind(filter.value)}
            />
          ))}
        </ScrollView>

        {reportes.isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator />
            <Text className="mt-3 text-sm text-muted-foreground">Cargando reportes…</Text>
          </View>
        ) : reportes.error ? (
          <ReportCard className="items-center p-6">
            <Text className="text-center text-sm text-muted-foreground">
              No se pudieron cargar los reportes. {reportes.error instanceof Error ? reportes.error.message : ""}
            </Text>
            <Button className="mt-4" onPress={() => reportes.refetch()}>
              <Text>Reintentar</Text>
            </Button>
          </ReportCard>
        ) : (
          <>
            {reportes.selectedEvent ? <EventInfoCard event={reportes.selectedEvent} /> : null}

            <SummaryCard
              total={report.total}
              regular={report.regular}
              secretary={report.secretary}
              capturistas={report.byCapturista.length}
              action={
                <GlassIconButton
                  icon="ci:share-ios-export"
                  accessibilityLabel="Exportar reporte en PDF"
                  onPress={onExport}
                  loading={exporting}
                  size={40}
                />
              }
            />

            {kind === "all" ? (
              <ChartCard title={REPORT_SECTIONS.type.title} subtitle={REPORT_SECTIONS.type.subtitle}>
                <DonutChart
                  data={SPLIT_SERIES.map((serie) => ({ key: serie.key, label: serie.label, value: report[serie.key] }))}
                  centerLabel="Solicitudes"
                />
              </ChartCard>
            ) : null}

            <ChartCard
              title={REPORT_SECTIONS.status.title}
              subtitle={`${REPORT_SECTIONS.status.subtitle} Toca una barra para ver el detalle.`}
            >
              <StackedBarChart data={report.byStatus} limit={REPORT_SECTIONS.status.limit} />
            </ChartCard>

            {kind !== "secretary" ? (
              <ChartCard title={REPORT_SECTIONS.services.title} subtitle={REPORT_SECTIONS.services.subtitle}>
                <HorizontalBarChart data={report.byService} limit={REPORT_SECTIONS.services.limit} />
              </ChartCard>
            ) : null}


            <ChartCard
              title={REPORT_SECTIONS.capturistas.title}
              subtitle={REPORT_SECTIONS.capturistas.subtitle}
            >
              <StackedBarChart data={report.byCapturista} limit={REPORT_SECTIONS.capturistas.limit} />
            </ChartCard>

          </>
        )}
      </CollapsingHeaderScrollView>
    </View>
  );
}
