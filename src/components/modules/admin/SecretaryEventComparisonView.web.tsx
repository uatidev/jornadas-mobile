"use client";

import { Button } from "@/src/components/ui/button";
import { Text } from "@/src/components/ui/text";
import { adminService } from "@/src/services/admin";
import { identityApi } from "@/src/services/identityApi";
import { requestsService } from "@/src/services/requests";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#981646", "#2563eb", "#059669", "#d97706"];
const STATUS_GROUPS = [
  { label: "Nuevas", statuses: ["enviada", "recibida"] },
  { label: "En revisión o atención", statuses: ["en_revision", "en_atencion"] },
  { label: "Falta información", statuses: ["requiere_informacion"] },
  { label: "En canalización", statuses: ["pendiente_canalizacion", "canalizada"] },
  { label: "En espera de apertura", statuses: ["en_espera_apertura"] },
  { label: "Aprobadas", statuses: ["aprobada"] },
  { label: "Concluidas", statuses: ["concluida", "atendida"] },
  { label: "No procedieron", statuses: ["rechazada"] },
  { label: "No continuaron", statuses: ["cancelada"] },
] as const;

type ChartRow = { label: string } & Record<string, string | number>;
type EventLegend = { id: string; name: string; color: string };

const tooltipStyle = { borderRadius: 12, border: "1px solid #e4e4e7", fontFamily: "Poppins, sans-serif" };
const normalizeText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX").replace(/[^a-z0-9]/g, "");

function GroupedChart({ data, events, percentage = false }: { data: ChartRow[]; events: EventLegend[]; percentage?: boolean }) {
  return <div style={{ width: "100%", height: 360 }}>
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 16, right: 16, left: percentage ? 0 : -12, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
        <XAxis dataKey="label" interval={0} angle={-15} textAnchor="end" height={80} tick={{ fontFamily: "Poppins, sans-serif", fontSize: 11 }} />
        <YAxis allowDecimals={false} domain={percentage ? [0, 100] : undefined} tickFormatter={percentage ? (value) => `${value}%` : undefined} tick={{ fontFamily: "Poppins, sans-serif", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [percentage ? `${value}%` : value, percentage ? "Porcentaje" : "Solicitudes"]} />
        <Legend wrapperStyle={{ fontFamily: "Poppins, sans-serif", fontSize: 12, paddingTop: 12 }} />
        {events.map((event) => <Bar key={event.id} dataKey={event.id} name={event.name} fill={event.color} radius={[5, 5, 0, 0]} maxBarSize={42}>
          <LabelList dataKey={event.id} position="top" formatter={(value: unknown) => Number(value) > 0 ? (percentage ? `${value}%` : String(value)) : ""} style={{ fontFamily: "Poppins, sans-serif", fontSize: 11, fontWeight: 700, fill: event.color }} />
        </Bar>)}
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

function SimpleLineComparisonChart({ data, events }: { data: ChartRow[]; events: EventLegend[] }) {
  return <div style={{ width: "100%", height: 360 }}>
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 16, right: 24, left: -12, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
        <XAxis dataKey="label" tick={{ fontFamily: "Poppins, sans-serif", fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontFamily: "Poppins, sans-serif", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Solicitudes"]} />
        <Legend wrapperStyle={{ fontFamily: "Poppins, sans-serif", fontSize: 12, paddingTop: 12 }} />
        {events.map((event) => <Line key={event.id} type="monotone" dataKey={event.id} name={event.name} stroke={event.color} strokeWidth={3} dot={{ r: 4, fill: event.color }} activeDot={{ r: 6 }} connectNulls />)}
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

export function SecretaryEventComparisonView() {
  const [candidateId, setCandidateId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const events = useQuery({ queryKey: ["secretaria", "events"], queryFn: adminService.listEvents });
  const services = useQuery({ queryKey: ["secretaria", "services"], queryFn: adminService.listServices });
  const units = useQuery({ queryKey: ["secretaria", "units"], queryFn: adminService.listUnits });
  const globalForm = useQuery({ queryKey: ["secretaria", "global-form"], queryFn: adminService.getGlobalForm });
  const regular = useQuery({ queryKey: ["secretaria", "requests"], queryFn: requestsService.listAllAccessible });
  const secretary = useQuery({ queryKey: ["secretaria", "secretary-requests"], queryFn: identityApi.listSecretaryRequests });

  const selectedEvents = useMemo(() => selectedIds.map((id, index) => {
    const event = (events.data || []).find((item) => item.id === id);
    return { id, name: event?.name || "Evento no disponible", color: COLORS[index], detail: event ? `${event.locality}, ${event.municipality} · ${new Date(event.startsAt).toLocaleDateString("es-MX")}` : "" };
  }), [events.data, selectedIds]);

  const allRequests = useMemo(() => [
    ...(regular.data || []).map((request) => ({ eventId: request.eventId, status: String(request.status), date: request.requestedAt, applicantData: request.applicantData || {} })),
    ...(secretary.data?.requests || []).map((request) => ({ eventId: request.eventId, status: String(request.status), date: request.createdAt, applicantData: request.applicantData || {} })),
  ], [regular.data, secretary.data?.requests]);

  const summary = useMemo(() => selectedEvents.map((event) => {
    const requests = allRequests.filter((request) => request.eventId === event.id);
    const count = (statuses: readonly string[]) => requests.filter((request) => statuses.includes(request.status)).length;
    const regularRequests = (regular.data || []).filter((request) => request.eventId === event.id);
    const serviceCounts = new Map<string, number>();
    regularRequests.forEach((request) => serviceCounts.set(request.serviceId, (serviceCounts.get(request.serviceId) || 0) + 1));
    const topService = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const resolved = count(["aprobada", "concluida", "atendida", "rechazada", "cancelada"]);
    return {
      ...event,
      total: requests.length,
      following: count(["en_revision", "en_atencion"]),
      approved: count(["aprobada"]),
      concluded: count(["concluida", "atendida"]),
      rejected: count(["rechazada"]),
      cancelled: count(["cancelada"]),
      resolvedRate: requests.length ? Math.round((resolved / requests.length) * 100) : 0,
      negativeRate: requests.length ? Math.round(((count(["rechazada", "cancelada"])) / requests.length) * 100) : 0,
      topService: topService ? (services.data || []).find((service) => service.id === topService[0])?.name || "Trámite sin nombre" : "Sin trámites",
      topServiceCount: topService?.[1] || 0,
    };
  }), [allRequests, regular.data, selectedEvents, services.data]);

  const statusChart = useMemo<ChartRow[]>(() => STATUS_GROUPS.map((group) => Object.assign({ label: group.label }, ...selectedEvents.map((event) => ({ [event.id]: allRequests.filter((request) => request.eventId === event.id && group.statuses.includes(request.status as never)).length })))), [allRequests, selectedEvents]);
  const percentageChart = useMemo<ChartRow[]>(() => STATUS_GROUPS.map((group) => Object.assign({ label: group.label }, ...selectedEvents.map((event) => {
    const eventRequests = allRequests.filter((request) => request.eventId === event.id);
    const value = eventRequests.filter((request) => group.statuses.includes(request.status as never)).length;
    return { [event.id]: eventRequests.length ? Math.round((value / eventRequests.length) * 100) : 0 };
  }))), [allRequests, selectedEvents]);

  const serviceChart = useMemo<ChartRow[]>(() => {
    const selectedRequests = (regular.data || []).filter((request) => selectedIds.includes(request.eventId || ""));
    const totals = new Map<string, number>();
    selectedRequests.forEach((request) => totals.set(request.serviceId, (totals.get(request.serviceId) || 0) + 1));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([serviceId]) => Object.assign(
      { label: (services.data || []).find((service) => service.id === serviceId)?.name || "Trámite sin nombre" },
      ...selectedEvents.map((event) => ({ [event.id]: selectedRequests.filter((request) => request.eventId === event.id && request.serviceId === serviceId).length })),
    ));
  }, [regular.data, selectedEvents, selectedIds, services.data]);

  const unitChart = useMemo<ChartRow[]>(() => {
    const selectedRequests = (regular.data || []).filter((request) => selectedIds.includes(request.eventId || ""));
    const totals = new Map<string, number>();
    selectedRequests.forEach((request) => totals.set(request.unitId, (totals.get(request.unitId) || 0) + 1));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([unitId]) => Object.assign(
      { label: (units.data || []).find((unit) => unit.id === unitId)?.name || "Unidad sin nombre" },
      ...selectedEvents.map((event) => ({ [event.id]: selectedRequests.filter((request) => request.eventId === event.id && request.unitId === unitId).length })),
    ));
  }, [regular.data, selectedEvents, selectedIds, units.data]);

  const dailyChart = useMemo<ChartRow[]>(() => {
    const dates = [...new Set(allRequests
      .filter((request) => selectedIds.includes(request.eventId || "") && request.date)
      .map((request) => request.date.slice(0, 10)))]
      .sort((a, b) => a.localeCompare(b));
    return dates.map((date) => Object.assign(
      { label: new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) },
      ...selectedEvents.map((event) => ({ [event.id]: allRequests.filter((request) => request.eventId === event.id && request.date.slice(0, 10) === date).length })),
    ));
  }, [allRequests, selectedEvents, selectedIds]);

  const genderChart = useMemo<ChartRow[]>(() => {
    const configuredKeys = (globalForm.data?.fields || [])
      .filter((field) => /sexo|genero/.test(normalizeText(`${field.key} ${field.label}`)))
      .map((field) => field.key);
    const values = allRequests
      .filter((request) => selectedIds.includes(request.eventId || ""))
      .map((request) => {
        const configuredValue = configuredKeys.map((key) => request.applicantData[key]).find((value) => String(value ?? "").trim());
        const fallbackValue = Object.entries(request.applicantData).find(([key, value]) => /sexo|genero/.test(normalizeText(key)) && String(value ?? "").trim())?.[1];
        return { eventId: request.eventId, value: String(configuredValue ?? fallbackValue ?? "").trim() };
      })
      .filter((item) => item.value);
    const options = [...new Set(values.map((item) => item.value))].sort((a, b) => a.localeCompare(b, "es-MX"));
    return options.map((option) => Object.assign(
      { label: option },
      ...selectedEvents.map((event) => ({ [event.id]: values.filter((item) => item.eventId === event.id && normalizeText(item.value) === normalizeText(option)).length })),
    ));
  }, [allRequests, globalForm.data?.fields, selectedEvents, selectedIds]);

  const addEvent = () => {
    if (!candidateId || selectedIds.includes(candidateId) || selectedIds.length >= COLORS.length) return;
    setSelectedIds((current) => [...current, candidateId]);
    setCandidateId("");
  };

  if ([events, services, units, globalForm, regular, secretary].some((query) => query.isLoading)) return <ActivityIndicator color="#981646" />;

  return <View className="gap-5">
    <View className="rounded-2xl border border-border bg-card p-5">
      <Text className="text-2xl font-bold">Comparar eventos</Text>
      <Text className="mt-1 text-sm text-muted-foreground">Agrega de dos a cuatro eventos. Cada evento conservará el mismo color en todas las gráficas.</Text>
      <View className="mt-5 flex-row items-end gap-3">
        <View className="min-w-80 flex-1 gap-2"><Text className="font-semibold">Agregar evento</Text><select value={candidateId} onChange={(event) => setCandidateId(event.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Selecciona un evento...</option>{(events.data || []).filter((event) => !selectedIds.includes(event.id)).map((event) => <option key={event.id} value={event.id}>{event.name} · {event.municipality}</option>)}</select></View>
        <Button disabled={!candidateId || selectedIds.length >= COLORS.length} onPress={addEvent}><Text>Agregar a comparación</Text></Button>
        {selectedIds.length ? <Button variant="outline" onPress={() => setSelectedIds([])}><Text>Limpiar</Text></Button> : null}
      </View>
    </View>

    {summary.length ? <View className="grid grid-cols-4 gap-4 max-xl:grid-cols-2">{summary.map((event) => <View key={event.id} className="rounded-2xl border bg-card p-5" style={{ borderColor: event.color }}><View className="mb-3 h-2 rounded-full" style={{ backgroundColor: event.color }} /><Text className="text-lg font-bold">{event.name}</Text><Text className="mt-1 text-xs text-muted-foreground">{event.detail}</Text><View className="mt-4 flex-row items-end justify-between"><Text className="text-sm text-muted-foreground">Solicitudes</Text><Text className="text-3xl font-bold" style={{ color: event.color }}>{event.total}</Text></View><View className="mt-4 gap-1 border-t border-border pt-3"><Text className="text-xs text-muted-foreground">Trámite más solicitado</Text><Text className="font-semibold">{event.topService}</Text><Text className="text-xs text-muted-foreground">{event.topServiceCount} solicitudes · {event.resolvedRate}% resueltas · {event.negativeRate}% no continuaron</Text></View><Pressable className="mt-4" onPress={() => setSelectedIds((current) => current.filter((id) => id !== event.id))}><Text className="text-sm font-semibold text-destructive">Quitar</Text></Pressable></View>)}</View> : null}

    {selectedEvents.length >= 2 ? <>
      <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Evolución diaria de solicitudes</Text><Text className="mt-1 text-sm text-muted-foreground">Cada línea muestra cuántas solicitudes se registraron por día en cada evento.</Text>{dailyChart.length ? <SimpleLineComparisonChart data={dailyChart} events={selectedEvents} /> : <Text className="py-16 text-center text-muted-foreground">No hay fechas de solicitudes para comparar.</Text>}</View>
      <View className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Comparación por estatus</Text><Text className="mt-1 text-sm text-muted-foreground">Cantidad de solicitudes regulares y solicitudes de Secretaría asociadas a cada evento.</Text><Text className="mt-2 text-xs text-muted-foreground">Los números del lado izquierdo son la escala de la gráfica. El valor real aparece encima de cada barra.</Text><GroupedChart data={statusChart} events={selectedEvents} /></View>
        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Composición porcentual</Text><Text className="mt-1 text-sm text-muted-foreground">Porcentaje que representa cada estatus dentro del total de solicitudes de cada evento.</Text><Text className="mt-2 text-xs text-muted-foreground">Ejemplo: 25% significa que una de cada cuatro solicitudes del evento está en ese estatus.</Text><GroupedChart data={percentageChart} events={selectedEvents} percentage /></View>
        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Trámites más solicitados</Text><Text className="mt-1 text-sm text-muted-foreground">Los ocho trámites con mayor demanda entre los eventos seleccionados.</Text>{serviceChart.length ? <GroupedChart data={serviceChart} events={selectedEvents} /> : <Text className="py-16 text-center text-muted-foreground">No hay trámites registrados para comparar.</Text>}</View>
        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Unidades con mayor demanda</Text><Text className="mt-1 text-sm text-muted-foreground">Solicitudes recibidas por unidad administrativa en cada evento.</Text>{unitChart.length ? <GroupedChart data={unitChart} events={selectedEvents} /> : <Text className="py-16 text-center text-muted-foreground">No hay unidades registradas para comparar.</Text>}</View>
        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Comparación por sexo o género</Text><Text className="mt-1 text-sm text-muted-foreground">Respuestas del formulario global agrupadas por evento.</Text>{genderChart.length ? <GroupedChart data={genderChart} events={selectedEvents} /> : <Text className="py-16 text-center text-muted-foreground">Los eventos seleccionados no tienen respuestas capturadas en el campo de sexo o género.</Text>}</View>
      </View>
      <View className="rounded-2xl border border-border bg-card p-5"><Text className="mb-4 text-xl font-bold">Resumen comparativo</Text><div className="overflow-auto rounded-xl border border-border"><table className="w-full min-w-[980px] border-collapse text-left text-sm"><thead className="bg-zinc-100"><tr><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">En revisión o atención</th><th className="px-4 py-3">Aprobadas</th><th className="px-4 py-3">Concluidas</th><th className="px-4 py-3">No procedieron</th><th className="px-4 py-3">No continuaron</th><th className="px-4 py-3">Avance</th><th className="px-4 py-3">Trámite principal</th></tr></thead><tbody>{summary.map((event) => <tr key={event.id} className="border-t border-border"><td className="px-4 py-3 font-semibold" style={{ color: event.color }}>{event.name}</td><td className="px-4 py-3">{event.total}</td><td className="px-4 py-3">{event.following}</td><td className="px-4 py-3">{event.approved}</td><td className="px-4 py-3">{event.concluded}</td><td className="px-4 py-3">{event.rejected}</td><td className="px-4 py-3">{event.cancelled}</td><td className="px-4 py-3">{event.resolvedRate}%</td><td className="px-4 py-3">{event.topService}</td></tr>)}</tbody></table></div></View>
    </> : <View className="rounded-2xl border border-dashed border-border bg-card p-10"><Text className="text-center font-bold">Agrega al menos dos eventos</Text><Text className="mt-1 text-center text-sm text-muted-foreground">Las gráficas comparativas aparecerán cuando tengas dos o más eventos seleccionados.</Text></View>}
  </View>;
}
