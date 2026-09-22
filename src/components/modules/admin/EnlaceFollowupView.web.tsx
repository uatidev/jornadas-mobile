"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import { adminService } from "@/src/services/admin";
import { identityApi } from "@/src/services/identityApi";
import { requestsService } from "@/src/services/requests";
import type { AttentionEvent } from "@/src/types/catalog";
import type { SecretaryRequest, ServiceRequest } from "@/src/types/request";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { Suspense, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { RequestsBarChart, StatusPieChart } from "./DashboardCharts.web";

const SecretaryEventsMap = React.lazy(() => import("./SecretaryEventsMap.web").then((module) => ({ default: module.SecretaryEventsMap })));

const STATUS_LABELS: Record<string, string> = {
  borrador: "Borrador", enviada: "Enviada", en_espera_apertura: "En espera de apertura", recibida: "Recibida", en_revision: "En revisión",
  requiere_informacion: "Requiere información", aprobada: "Aprobada", rechazada: "No procedió",
  cancelada: "No continuó", concluida: "Concluida", en_atencion: "En atención",
  pendiente_canalizacion: "Pendiente de canalización", canalizada: "Canalizada", atendida: "Atendida",
};

const normalizeFieldName = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[_-]+/g, " ")
  .toLocaleLowerCase("es-MX");

const isAgeField = (key: string, label = "") => /(^|\W)(edad|age)(\W|$)/.test(normalizeFieldName(`${key} ${label}`));
const isGenderField = (key: string, label = "") => /(^|\W)(genero|sexo|gender)(\W|$)/.test(normalizeFieldName(`${key} ${label}`));

type UnifiedRequest = {
  id: string; kind: "regular" | "secretaria"; folio: string; eventId?: string; eventFolio?: string;
  service: string; unit: string; capturedBy: string; capturedById: string; status: string; date: string;
  applicantData: Record<string, unknown>;
  outcomeReason?: string;
};

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <View className="min-w-56 flex-1 rounded-2xl border border-border bg-card p-5"><Text className="text-sm text-muted-foreground">{label}</Text><Text className="mt-2 text-3xl font-bold">{value}</Text><Text className="mt-2 text-xs text-muted-foreground">{note}</Text></View>;
}

function RequestTable({ rows, eventNames }: { rows: UnifiedRequest[]; eventNames: Record<string, string> }) {
  const router = useRouter();
  return <div className="max-h-[560px] overflow-auto rounded-xl border border-zinc-200"><table className="w-full min-w-[1180px] border-collapse text-left text-sm">
    <thead className="sticky top-0 z-10 bg-zinc-100"><tr>{["Folio", "Fecha", "Evento", "Trámite / asunto", "Unidad", "Capturó", "Estatus", "Acciones"].map((label) => <th key={label} className="whitespace-nowrap border-b border-zinc-200 px-4 py-3 text-xs font-bold uppercase text-zinc-500">{label}</th>)}</tr></thead>
    <tbody>{rows.map((item) => <tr key={`${item.kind}-${item.id}`} className="border-b border-zinc-200 last:border-0 hover:bg-zinc-50">
      <td className="whitespace-nowrap px-4 py-3 font-semibold text-primary">{item.folio}</td><td className="whitespace-nowrap px-4 py-3">{new Date(item.date).toLocaleDateString("es-MX")}</td>
      <td className="max-w-56 px-4 py-3">{item.eventId ? eventNames[item.eventId] || item.eventFolio || "Evento no disponible" : "Sin evento"}</td><td className="max-w-64 px-4 py-3">{item.service}</td><td className="max-w-56 px-4 py-3">{item.unit}</td><td className="max-w-48 px-4 py-3">{item.capturedBy}</td>
      <td className="whitespace-nowrap px-4 py-3"><span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">{STATUS_LABELS[item.status] || item.status.replaceAll("_", " ")}</span></td>
      <td className="px-4 py-3"><Button size="sm" variant="outline" onPress={() => router.push((item.kind === "secretaria" ? `/admin/solicitud-secretaria/${item.id}` : `/admin/solicitud/${item.id}`) as never)}><Text>Ver expediente</Text></Button></td>
    </tr>)}{!rows.length ? <tr><td colSpan={8} className="px-4 py-12 text-center text-zinc-500">No hay solicitudes que coincidan con los filtros.</td></tr> : null}</tbody>
  </table></div>;
}

export function EnlaceFollowupView({ mode }: { mode: "seguimiento" | "evento" }) {
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState("");
  const [groupByEvent, setGroupByEvent] = useState(false);
  const regular = useQuery({ queryKey: ["enlace", "all-requests"], queryFn: requestsService.listAllAccessible });
  const secretary = useQuery({ queryKey: ["enlace", "secretary-requests"], queryFn: identityApi.listSecretaryRequests });
  const services = useQuery({ queryKey: ["enlace", "services"], queryFn: adminService.listServices });
  const units = useQuery({ queryKey: ["enlace", "units"], queryFn: adminService.listUnits });
  const events = useQuery({ queryKey: ["enlace", "events"], queryFn: adminService.listEvents });
  const staff = useQuery({ queryKey: ["enlace", "reporting-staff"], queryFn: identityApi.getReportingStaff });
  const globalForm = useQuery({ queryKey: ["enlace", "global-form"], queryFn: adminService.getGlobalForm });
  const serviceNames = useMemo(() => Object.fromEntries((services.data || []).map((item) => [item.id, item.name])), [services.data]);
  const unitNames = useMemo(() => Object.fromEntries((units.data || []).map((item) => [item.id, item.name])), [units.data]);
  const eventNames = useMemo(() => Object.fromEntries((events.data || []).map((item) => [item.id, item.name])), [events.data]);
  const staffNames = useMemo(() => Object.fromEntries((staff.data?.staff || []).map((item) => [item.id, item.name])), [staff.data]);
  const allRows = useMemo<UnifiedRequest[]>(() => [
    ...(regular.data || []).map((item: ServiceRequest) => ({ id: item.id, kind: "regular" as const, folio: item.folio, eventId: item.eventId, eventFolio: item.eventFolio, service: serviceNames[item.serviceId] || "Trámite no disponible", unit: unitNames[item.unitId] || "Unidad no disponible", capturedBy: staffNames[item.applicantUserId] || "No identificado", capturedById: item.applicantUserId, status: item.status, date: item.requestedAt, applicantData: item.applicantData || {}, outcomeReason: item.discontinuationReason })),
    ...(secretary.data?.requests || []).map((item: SecretaryRequest) => ({ id: item.id, kind: "secretaria" as const, folio: item.folio, eventId: item.eventId, eventFolio: item.eventFolio, service: item.subject || "Solicitud prioritaria", unit: item.responsibleUnitId ? unitNames[item.responsibleUnitId] || "Unidad no disponible" : "Sin unidad asignada", capturedBy: item.capturedByName || staffNames[item.capturedByUserId] || "No identificado", capturedById: item.capturedByUserId, status: item.status, date: item.createdAt, applicantData: item.applicantData || {} })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [regular.data, secretary.data?.requests, serviceNames, unitNames, staffNames]);
  const filteredRows = useMemo(() => { const term = search.trim().toLocaleLowerCase("es-MX"); return allRows.filter((item) => (!eventId || item.eventId === eventId) && (!status || item.status === status) && (!term || [item.folio, item.service, item.unit, item.capturedBy, item.eventId ? eventNames[item.eventId] : ""].some((value) => value?.toLocaleLowerCase("es-MX").includes(term)))); }, [allRows, eventId, eventNames, search, status]);
  const selectedEvent = (events.data || []).find((item) => item.id === eventId);
  const eventRows = useMemo(() => eventId ? allRows.filter((item) => item.eventId === eventId) : [], [allRows, eventId]);
  const ranking = (key: "service" | "unit" | "capturedBy") => { const counts = new Map<string, number>(); for (const item of eventRows) counts.set(item[key], (counts.get(item[key]) || 0) + 1); return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); };
  const serviceRanking = ranking("service"); const unitRanking = ranking("unit"); const staffRanking = ranking("capturedBy");
  const statusRanking = useMemo(() => { const counts = new Map<string, number>(); for (const item of eventRows) counts.set(item.status, (counts.get(item.status) || 0) + 1); return [...counts.entries()].map(([key, value]) => ({ label: STATUS_LABELS[key] || key, value })); }, [eventRows]);
  const rejectionReasons = useMemo(() => { const counts = new Map<string, number>(); for (const item of eventRows.filter((row) => row.status === "rechazada")) { const reason = item.outcomeReason || "Sin motivo registrado"; counts.set(reason, (counts.get(reason) || 0) + 1); } return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); }, [eventRows]);
  const cancellationReasons = useMemo(() => { const counts = new Map<string, number>(); for (const item of eventRows.filter((row) => row.status === "cancelada")) { const reason = item.outcomeReason || "Sin motivo registrado"; counts.set(reason, (counts.get(reason) || 0) + 1); } return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); }, [eventRows]);
  const ageChart = useMemo(() => {
    const fields = globalForm.data?.fields || [];
    const configuredKeys = fields.filter((field) => isAgeField(field.key, field.label)).map((field) => field.key);
    const counts = new Map<string, number>();
    for (const row of eventRows) {
      const configuredKey = configuredKeys.find((key) => String(row.applicantData[key] ?? "").trim());
      const fallback = Object.entries(row.applicantData).find(([key, value]) => isAgeField(key) && String(value ?? "").trim());
      const numericAge = Number(configuredKey ? row.applicantData[configuredKey] : fallback?.[1]);
      if (!Number.isFinite(numericAge) || numericAge < 0 || numericAge > 120) continue;
      const age = String(Math.floor(numericAge));
      counts.set(age, (counts.get(age) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => Number(a.label) - Number(b.label));
  }, [eventRows, globalForm.data?.fields]);
  const genderChart = useMemo(() => {
    const fields = globalForm.data?.fields || [];
    const configuredKeys = fields.filter((field) => isGenderField(field.key, field.label)).map((field) => field.key);
    const counts = new Map<string, number>();
    for (const row of eventRows) {
      const configuredKey = configuredKeys.find((key) => String(row.applicantData[key] ?? "").trim());
      const fallback = Object.entries(row.applicantData).find(([key, value]) => isGenderField(key) && String(value ?? "").trim());
      const value = String(configuredKey ? row.applicantData[configuredKey] : fallback?.[1] || "").trim();
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [eventRows, globalForm.data?.fields]);
  const choiceCharts = useMemo(() => (globalForm.data?.fields || [])
    .filter((field) => (field.type === "select" || field.type === "multiselect") && !isGenderField(field.key, field.label) && !isAgeField(field.key, field.label))
    .map((field) => {
      const counts = new Map((field.options || []).map((option) => [option, 0]));
      let answered = 0;
      for (const row of eventRows) {
        const raw = row.applicantData[field.key];
        const values = Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split("|");
        const selected = values.map((value) => value.trim()).filter(Boolean);
        if (selected.length) answered += 1;
        for (const value of selected) counts.set(value, (counts.get(value) || 0) + 1);
      }
      return { key: field.key, label: field.label, answered, data: [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value) };
    }), [eventRows, globalForm.data?.fields]);
  const loading = regular.isLoading || secretary.isLoading || services.isLoading || units.isLoading || events.isLoading || staff.isLoading || globalForm.isLoading;
  if (loading) return <ActivityIndicator color="#981646" />;

  if (mode === "seguimiento") {
    const groups = filteredRows.reduce((result, item) => {
      const key = item.eventId || "sin-evento";
      const current = result.get(key) || [];
      current.push(item);
      result.set(key, current);
      return result;
    }, new Map<string, UnifiedRequest[]>());
    return <View className="gap-5"><View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Seguimiento de todas las solicitudes</Text><Text className="mb-4 mt-1 text-sm text-muted-foreground">Incluye trámites, servicios y solicitudes prioritarias de Secretaría.</Text><View className="grid grid-cols-4 gap-3 max-xl:grid-cols-2"><Input value={search} onChangeText={setSearch} placeholder="Buscar folio, trámite, unidad..." /><select value={eventId} onChange={(e) => setEventId(e.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Todos los eventos</option>{(events.data || []).map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select><select value={status} onChange={(e) => setStatus(e.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Todos los estatus</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><Button variant={groupByEvent ? "default" : "outline"} onPress={() => setGroupByEvent((value) => !value)}><Text>{groupByEvent ? "Vista por evento" : "Vista por solicitudes"}</Text></Button></View></View>
      <View className="flex-row flex-wrap gap-4"><Metric label="Solicitudes" value={filteredRows.length} note="Resultado de los filtros" /><Metric label="Eventos" value={new Set(filteredRows.map((item) => item.eventId).filter(Boolean)).size} note="Con solicitudes registradas" /><Metric label="Pendientes" value={filteredRows.filter((item) => ["enviada", "recibida", "en_revision", "en_atencion", "requiere_informacion", "pendiente_canalizacion"].includes(item.status)).length} note="Requieren seguimiento" /><Metric label="Concluidas" value={filteredRows.filter((item) => ["concluida", "atendida"].includes(item.status)).length} note="Atención terminada" /></View>
      {groupByEvent ? <View className="gap-4">{[...groups.entries()].map(([id, rows]) => <View key={id} className="rounded-2xl border border-border bg-card p-5"><Text className="mb-1 text-xl font-bold">{id === "sin-evento" ? "Sin evento" : eventNames[id] || "Evento no disponible"}</Text><Text className="mb-4 text-sm text-muted-foreground">{rows.length} solicitudes</Text><RequestTable rows={rows} eventNames={eventNames} /></View>)}</View> : <View className="rounded-2xl border border-border bg-card p-5"><RequestTable rows={filteredRows} eventNames={eventNames} /></View>}
    </View>;
  }

  return <View className="gap-5"><View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Selecciona un evento</Text><Text className="mb-4 mt-1 text-sm text-muted-foreground">Consulta ubicación, demanda, unidades participantes, capturistas y datos del formulario global.</Text><select value={eventId} onChange={(e) => setEventId(e.currentTarget.value)} className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3"><option value="">Selecciona un evento...</option>{(events.data || []).map((event) => <option key={event.id} value={event.id}>{event.folioPrefix} · {event.name} · {event.municipality}</option>)}</select></View>
    {selectedEvent ? <><View className="overflow-hidden rounded-2xl border border-border bg-card"><Suspense fallback={<ActivityIndicator color="#981646" />}><SecretaryEventsMap events={[selectedEvent] as AttentionEvent[]} requestCounts={{ [selectedEvent.id]: eventRows.length }} height={480} autoSelect /></Suspense></View>
      <View className="flex-row flex-wrap gap-4"><Metric label="Solicitudes" value={eventRows.length} note="Registros del evento" /><Metric label="Trámite más solicitado" value={serviceRanking[0]?.label || "Sin datos"} note={`${serviceRanking[0]?.value || 0} solicitudes`} /><Metric label="Unidades participantes" value={unitRanking.length} note="Áreas con solicitudes" /><Metric label="Personal capturista" value={staffRanking.length} note="Personas que registraron" /></View>
      <View className="flex-row flex-wrap gap-4">{statusRanking.map((status) => <Metric key={status.label} label={status.label} value={status.value} note={`${eventRows.length ? Math.round((status.value / eventRows.length) * 100) : 0}% del evento`} />)}</View>
      <View className="grid grid-cols-2 gap-5 max-xl:grid-cols-1"><View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Trámites más solicitados</Text><RequestsBarChart data={serviceRanking.slice(0, 8)} /></View><View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Solicitudes por estatus</Text><StatusPieChart data={statusRanking} /></View><View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Unidades participantes</Text><RequestsBarChart data={unitRanking.slice(0, 8)} /></View><View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Quiénes capturaron</Text><RequestsBarChart data={staffRanking.slice(0, 8)} /></View></View>
      {(rejectionReasons.length || cancellationReasons.length) ? <View className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">{rejectionReasons.length ? <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Motivos por los que no procedieron</Text><Text className="mb-4 mt-1 text-sm text-muted-foreground">Causas registradas por las unidades responsables.</Text><RequestsBarChart data={rejectionReasons} /></View> : null}{cancellationReasons.length ? <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Motivos por los que no continuaron</Text><Text className="mb-4 mt-1 text-sm text-muted-foreground">Solicitudes cuyo proceso se interrumpió.</Text><RequestsBarChart data={cancellationReasons} /></View> : null}</View> : null}
      <View className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Personas por edad</Text><Text className="mb-4 mt-1 text-sm text-muted-foreground">Cantidad de personas registrada para cada edad exacta.</Text>{ageChart.length ? <RequestsBarChart data={ageChart} /> : <Text className="py-8 text-center text-muted-foreground">Sin respuestas de edad para este evento.</Text>}</View>
        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Distribución por sexo o género</Text><Text className="mb-4 mt-1 text-sm text-muted-foreground">Respuestas registradas en el formulario global.</Text>{genderChart.length ? <StatusPieChart data={genderChart} /> : <Text className="py-8 text-center text-muted-foreground">Sin respuestas de sexo o género para este evento.</Text>}</View>
      </View>
      {choiceCharts.length ? <View className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">{choiceCharts.map((chart) => <View key={chart.key} className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">{chart.label}</Text><Text className="mb-4 mt-1 text-sm text-muted-foreground">{chart.answered} respuestas · Pregunta de {globalForm.data?.fields.find((field) => field.key === chart.key)?.type === "multiselect" ? "selección múltiple" : "opción"}.</Text>{chart.data.some((item) => item.value > 0) ? <RequestsBarChart data={chart.data} /> : <Text className="py-8 text-center text-muted-foreground">Sin respuestas para este evento.</Text>}</View>)}</View> : null}
      <View className="rounded-2xl border border-border bg-card p-5"><Text className="mb-4 text-xl font-bold">Listado de solicitudes del evento</Text><RequestTable rows={eventRows} eventNames={eventNames} /></View></> : <View className="rounded-2xl border border-dashed border-border bg-card p-12"><Text className="text-center text-muted-foreground">Selecciona un evento para generar el reporte.</Text></View>}
  </View>;
}
