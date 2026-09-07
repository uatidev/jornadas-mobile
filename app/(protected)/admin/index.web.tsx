"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import { useAuth } from "@/src/providers/AuthProvider";
import {
  adminService,
  AttentionEventInput,
  type ServiceRequirementInput,
  ServiceInput,
} from "@/src/services/admin";
import { requestsService } from "@/src/services/requests";
import { identityApi } from "@/src/services/identityApi";
import { filesService } from "@/src/services/files";
import {
  FormFieldBuilder,
  isFormBuilderValid,
} from "@/src/components/modules/admin/FormFieldBuilder.web";
import { RequirementBuilder } from "@/src/components/modules/admin/RequirementBuilder.web";
import { TargetAudienceBuilder } from "@/src/components/modules/admin/TargetAudienceBuilder.web";
import type {
  AdministrativeUnit,
  AttentionEvent,
  ProcedureService,
  ServiceFormField,
  ServiceType,
} from "@/src/types/catalog";
import React, { Suspense } from "react";

// Importación dinámica para evitar que Leaflet se ejecute en el servidor (SSR)
const LocationPicker = React.lazy(() =>
  import("@/src/components/modules/admin/LocationPicker.web").then((m) => ({
    default: m.LocationPicker,
  })),
);
const SecretaryEventsMap = React.lazy(() =>
  import("@/src/components/modules/admin/SecretaryEventsMap.web").then((m) => ({
    default: m.SecretaryEventsMap,
  })),
);

import {
  municipalityFolioCode,
  resolveTabascoMunicipality,
  TABASCO_CENTER,
  TABASCO_MUNICIPALITIES,
} from "@/src/constants/tabasco";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";

type Section =
  | "resumen"
  | "formulario"
  | "eventos"
  | "unidades"
  | "tramites"
  | "usuarios"
  | "solicitudes";
type SecretarySection = "resumen" | "eventos" | "solicitudes";
const EMPTY: ServiceInput = {
  unitId: "",
  code: "",
  type: "tramite",
  name: "",
  description: "",
  targetAudience: "",
  cost: "Gratuito",
  active: true,
  usesGlobalForm: true,
  programFolioPrefix: "",
  opensAt: "",
  closesAt: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  requirements: [],
};
const EMPTY_EVENT: AttentionEventInput = {
  name: "",
  municipality: "Centro",
  locality: "",
  municipalityCode: "CENTRO",
  venue: "",
  address: "",
  startsAt: "",
  endsAt: "",
  latitude: TABASCO_CENTER[0],
  longitude: TABASCO_CENTER[1],
  active: true,
  folioPrefix: "CENTRO",
  notes: "",
};

const nav: { key: Section; label: string; icon: string }[] = [
  { key: "resumen", label: "Resumen", icon: "▦" },
  { key: "formulario", label: "Formulario global", icon: "✎" },
  { key: "eventos", label: "Eventos de atención", icon: "⌖" },
  { key: "unidades", label: "Unidades administrativas", icon: "▦" },
  { key: "tramites", label: "Trámites y servicios", icon: "☰" },
  { key: "usuarios", label: "Usuarios y enlaces", icon: "◉" },
  { key: "solicitudes", label: "Solicitudes", icon: "▤" },
];
const secretaryNav: { key: SecretarySection; label: string; icon: string }[] = [
  { key: "resumen", label: "Resumen ejecutivo", icon: "◦" },
  { key: "eventos", label: "Eventos y mapa", icon: "⌖" },
  { key: "solicitudes", label: "Reporte de solicitudes", icon: "▤" },
];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold">{label}</Text>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

function UnitPicker({
  units,
  value,
  onChange,
}: {
  units: AdministrativeUnit[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold">Unidad administrativa</Text>
      <View className="flex-row flex-wrap gap-2">
        {units.map((unit) => (
          <Pressable
            key={unit.id}
            onPress={() => onChange(unit.id)}
            className={`rounded-lg border px-3 py-2 ${value === unit.id ? "border-primary bg-primary/10" : "border-border bg-background"}`}
          >
            <Text
              className={`text-sm ${value === unit.id ? "font-semibold text-primary" : ""}`}
            >
              {unit.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <View className="min-w-48 flex-1 rounded-2xl border border-border bg-card p-5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="mt-2 text-3xl font-bold">{value}</Text>
      <Text className="mt-2 text-xs text-muted-foreground">{note}</Text>
    </View>
  );
}

function OperationalSidebar({
  active,
  title,
}: {
  active: "bandeja" | "canalizacion";
  title: string;
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const units = useQuery({
    queryKey: ["sidebar", "units"],
    queryFn: adminService.listUnits,
    enabled: Boolean(user?.unidadAdministrativaId),
  });
  const assignedUnit = units.data?.find(
    (unit) => unit.id === user?.unidadAdministrativaId,
  );
  const itemClass = (selected: boolean) =>
    `w-full rounded-xl px-4 py-3 ${selected ? "bg-primary" : "hover:bg-muted"}`;
  return (
    <View className="w-72 border-r border-border bg-card p-5">
      <View className="mb-8 border-b border-border pb-5">
        <Text className="text-xl font-bold text-primary">Jornadas</Text>
        <Text className="mt-1 text-xs text-muted-foreground">{title}</Text>
      </View>
      <View className="gap-2">
        <Pressable className={itemClass(active === "bandeja" || active === "canalizacion")}>
          <Text className="font-semibold text-primary-foreground">{active === "canalizacion" ? "Mesa de canalización" : "Bandeja de solicitudes"}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/home" as any)} className={itemClass(false)}>
          <Text className="font-medium">＋ Nueva captura</Text>
          <Text className="mt-1 text-xs text-muted-foreground">Registrar una solicitud</Text>
        </Pressable>
      </View>
      <View className="mt-auto border-t border-border pt-5">
        <Text className="font-semibold">{user?.nombre}</Text>
        <Text className="mt-1 text-xs capitalize text-muted-foreground">{user?.role?.replaceAll("_", " ")}</Text>
        <View className="mb-4 mt-3 rounded-lg bg-muted p-3">
          <Text className="text-[10px] font-bold uppercase text-muted-foreground">Unidad administrativa</Text>
          <Text className="mt-1 text-sm font-semibold">
            {units.isLoading ? "Cargando..." : assignedUnit?.name || "Sin unidad asignada"}
          </Text>
        </View>
        <Button variant="outline" onPress={logout}><Text>Cerrar sesión</Text></Button>
      </View>
    </View>
  );
}

function HorizontalBarChart({
  title,
  data,
}: {
  title: string;
  data: { label: string; value: number; color?: string }[];
}) {
  const maximum = Math.max(1, ...data.map((item) => item.value));
  return (
    <View className="min-w-80 flex-1 rounded-2xl border border-border bg-card p-5">
      <Text className="mb-5 text-lg font-bold">{title}</Text>
      <View className="gap-4">
        {data.map((item) => (
          <View key={item.label} className="gap-1.5">
            <View className="flex-row justify-between gap-3">
              <Text className="flex-1 text-sm" numberOfLines={1}>{item.label}</Text>
              <Text className="font-bold">{item.value}</Text>
            </View>
            <View className="h-3 overflow-hidden rounded-full bg-muted">
              <View
                className="h-full rounded-full"
                style={{ width: `${(item.value / maximum) * 100}%`, backgroundColor: item.color || "#981646" }}
              />
            </View>
          </View>
        ))}
        {!data.length ? <Text className="text-sm text-muted-foreground">Sin datos en el periodo.</Text> : null}
      </View>
    </View>
  );
}

const EVENT_TIME_ZONE = "America/Mexico_City";
const formatEventDateTime = (value: string) =>
  new Date(value).toLocaleString("es-MX", {
    timeZone: EVENT_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
const formatRequestValue = (value: unknown) => {
  if (typeof value !== "string") return String(value ?? "—");
  try {
    const parsed = JSON.parse(value);
    return parsed?.name ? `Archivo: ${parsed.name}` : value;
  } catch {
    return value || "—";
  }
};

function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const localValue = (() => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: EVENT_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
  })();
  return (
    <View className="flex-1 gap-2">
      <Text className="text-sm font-semibold">{label}</Text>
      <input
        type="datetime-local"
        value={localValue}
        onChange={(event) =>
          onChange(
            event.currentTarget.value
              ? new Date(`${event.currentTarget.value}:00-06:00`).toISOString()
              : "",
          )
        }
        style={{
          minHeight: 40,
          border: "1px solid #d4d4d8",
          borderRadius: 8,
          padding: "8px 12px",
          background: "transparent",
          color: "inherit",
        }}
      />
    </View>
  );
}

const REQUEST_STATUSES = [
  "recibida",
  "en_revision",
  "requiere_informacion",
  "aprobada",
  "rechazada",
  "cancelada",
  "concluida",
] as const;

const REQUEST_STATUS_LABELS: Record<string, string> = {
  enviada: "Nueva",
  recibida: "Recibida",
  en_revision: "En seguimiento",
  requiere_informacion: "Requiere información",
  aprobada: "Aprobada",
  rechazada: "No procedió",
  cancelada: "No continuó",
  concluida: "Concluida",
};

const getEventStatus = (event: AttentionEvent) => {
  const now = Date.now();
  const startsAt = new Date(event.startsAt).getTime();
  const endsAt = new Date(event.endsAt).getTime();
  if (!event.active || !Number.isFinite(endsAt) || endsAt < now)
    return "Finalizado";
  if (Number.isFinite(startsAt) && startsAt > now) return "Programado";
  return "Activo";
};

function GestorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<
    Record<string, {
      status: string;
      comment: string;
      discontinuationReason: string;
      receivedBenefit?: boolean;
      benefitDetail: string;
    }>
  >({});
  const [notice, setNotice] = useState<string | null>(null);
  const [reassignmentReasons, setReassignmentReasons] = useState<Record<string, string>>({});
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const requests = useQuery({
    queryKey: ["gestor", "requests", user?.unidadAdministrativaId],
    queryFn: () => requestsService.listByUnit(user!.unidadAdministrativaId!),
    enabled: Boolean(user?.unidadAdministrativaId),
  });
  const services = useQuery({ queryKey: ["gestor", "services"], queryFn: adminService.listServices });
  const events = useQuery({ queryKey: ["gestor", "events"], queryFn: adminService.listEvents });
  const reportingStaff = useQuery({ queryKey: ["gestor", "reporting-staff"], queryFn: identityApi.getReportingStaff });
  const serviceNames = useMemo(() => Object.fromEntries((services.data || []).map((service) => [service.id, service.name])), [services.data]);
  const eventNames = useMemo(() => Object.fromEntries((events.data || []).map((event) => [event.id, event.name])), [events.data]);
  const staffNames = useMemo(() => Object.fromEntries((reportingStaff.data?.staff || []).map((member) => [member.id, member.name])), [reportingStaff.data]);
  const filteredRequests = useMemo(
    () => (requests.data || []).filter((request) =>
      (!statusFilter || request.status === statusFilter) &&
      (!serviceFilter || request.serviceId === serviceFilter),
    ),
    [requests.data, serviceFilter, statusFilter],
  );
  const selectedRequest = (requests.data || []).find((request) => request.id === selectedRequestId);
  const update = useMutation({
    mutationFn: ({ id }: { id: string }) => {
      const draft = drafts[id];
      return identityApi.updateStatus(id, draft.status, draft.comment, {
        finalResult: REQUEST_STATUS_LABELS[draft.status],
        discontinuationReason: draft.discontinuationReason,
        receivedBenefit: draft.receivedBenefit,
        benefitDetail: draft.benefitDetail,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gestor", "requests"] });
      setNotice("Solicitud actualizada correctamente.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });
  const requestReassignment = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      identityApi.requestReassignment(id, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gestor", "requests"] });
      setNotice("La solicitud se envió a la bandeja de canalización del enlace.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });

  return (
    <View className="h-screen flex-row bg-muted/30">
      <OperationalSidebar active="bandeja" title="Gestión de solicitudes" />
      <View className="flex-1 overflow-hidden">
      <View className="flex-row items-center justify-between border-b border-border bg-card px-8 py-5">
        <View>
          <Text className="text-2xl font-bold">Atención de solicitudes</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            {user?.nombre} · Solicitudes de tu unidad administrativa
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 32, gap: 16 }}>
        {notice ? (
          <View className="rounded-xl border border-primary/30 bg-primary/10 p-3">
            <Text className="text-primary">{notice}</Text>
          </View>
        ) : null}
        {!user?.unidadAdministrativaId ? (
          <View className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <Text className="font-semibold text-destructive">Tu cuenta de Gestor no tiene una unidad administrativa asignada.</Text>
            <Text className="mt-1 text-sm text-muted-foreground">Solicita al Superadministrador que relacione tu perfil con la unidad correspondiente.</Text>
          </View>
        ) : null}
        {requests.isLoading ? <ActivityIndicator color="#981646" /> : null}
        <View className="rounded-2xl border border-border bg-card p-5">
          <View className="mb-4 flex-row flex-wrap items-end gap-3">
            <View className="min-w-56 flex-1 gap-2">
              <Text className="text-sm font-semibold">Filtrar por trámite</Text>
              <select value={serviceFilter} onChange={(event) => setServiceFilter(event.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2">
                <option value="">Todos los trámites</option>
                {(services.data || []).filter((service) => service.unitId === user?.unidadAdministrativaId).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </View>
            <View className="min-w-48 flex-1 gap-2">
              <Text className="text-sm font-semibold">Filtrar por estatus</Text>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2">
                <option value="">Todos los estatus</option>
                {["enviada", ...REQUEST_STATUSES].map((status) => <option key={status} value={status}>{REQUEST_STATUS_LABELS[status] || status}</option>)}
              </select>
            </View>
            <Button variant="outline" onPress={() => { setStatusFilter(""); setServiceFilter(""); }}><Text>Limpiar filtros</Text></Button>
          </View>
          <View className="overflow-hidden rounded-xl border border-border">
            <View className="grid grid-cols-[1fr_1.8fr_1fr_1fr_1fr] gap-3 bg-muted px-4 py-3">
              <Text className="text-xs font-bold">FOLIO</Text>
              <Text className="text-xs font-bold">TRÁMITE</Text>
              <Text className="text-xs font-bold">EVENTO</Text>
              <Text className="text-xs font-bold">CAPTURISTA</Text>
              <Text className="text-xs font-bold">ESTATUS</Text>
            </View>
            {filteredRequests.map((request) => (
              <Pressable key={request.id} onPress={() => router.push(`/admin/solicitud/${request.id}` as any)} className="grid grid-cols-[1fr_1.8fr_1fr_1fr_1fr] gap-3 border-t border-border px-4 py-4 hover:bg-muted/50">
                <View>
                  <Text className="font-semibold">{request.folio}</Text>
                  <Text className="text-xs text-muted-foreground">{new Date(request.requestedAt).toLocaleDateString("es-MX")}</Text>
                  {request.priorityOnReopening ? (
                    <Text className="mt-1 text-xs font-bold text-amber-700">PRIORIDAD AL REABRIR</Text>
                  ) : null}
                </View>
                <Text>{serviceNames[request.serviceId] || "Trámite no disponible"}</Text>
                <Text>{request.eventId ? eventNames[request.eventId] || request.eventFolio || "Evento" : "Fuera de evento"}</Text>
                <Text>{staffNames[request.applicantUserId] || "No identificado"}</Text>
                <Text className="text-primary">{REQUEST_STATUS_LABELS[request.status] || request.status}</Text>
              </Pressable>
            ))}
            {!filteredRequests.length && !requests.isLoading ? <Text className="p-8 text-center text-muted-foreground">No hay solicitudes que coincidan con los filtros.</Text> : null}
          </View>
        </View>
        {false && selectedRequest ? [selectedRequest].map((request) => {
          const draft = drafts[request.id] || {
            status: request.status,
            comment: request.notes || "",
            discontinuationReason: request.discontinuationReason || "",
            receivedBenefit: request.receivedBenefit,
            benefitDetail: request.benefitDetail || "",
          };
          return (
            <View
              key={request.id}
              className="gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <View className="flex-row items-center justify-between border-b border-border pb-4">
                <View>
                  <Text className="text-xl font-bold">Detalle de la solicitud</Text>
                  <Text className="mt-1 text-sm text-muted-foreground">Consulta el expediente completo y registra el seguimiento.</Text>
                </View>
                <Button variant="outline" onPress={() => setSelectedRequestId(null)}><Text>Cerrar detalle</Text></Button>
              </View>
              <View className="flex-row items-start justify-between">
                <View>
                  <Text className="text-lg font-bold">{request.folio}</Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    Evento: {request.eventFolio || "Sin folio"} ·{" "}
                    {new Date(request.requestedAt).toLocaleString("es-MX")}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-primary">
                    {REQUEST_STATUS_LABELS[request.status] || request.status.replaceAll("_", " ")}
                  </Text>
                  {request.priorityOnReopening ? (
                    <Text className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Prioridad al reabrir</Text>
                  ) : null}
                </View>
              </View>
              <View className="grid grid-cols-3 gap-3">
                <View className="rounded-xl bg-muted/50 p-4">
                  <Text className="text-xs font-bold text-muted-foreground">TRÁMITE</Text>
                  <Text className="mt-1 font-semibold">{serviceNames[request.serviceId] || "No disponible"}</Text>
                </View>
                <View className="rounded-xl bg-muted/50 p-4">
                  <Text className="text-xs font-bold text-muted-foreground">EVENTO</Text>
                  <Text className="mt-1 font-semibold">{request.eventId ? eventNames[request.eventId] || request.eventFolio || "Evento no disponible" : "Captura fuera de evento"}</Text>
                  {request.eventFolio ? <Text className="mt-1 text-xs text-muted-foreground">Folio: {request.eventFolio}</Text> : null}
                </View>
                <View className="rounded-xl bg-muted/50 p-4">
                  <Text className="text-xs font-bold text-muted-foreground">CAPTURISTA</Text>
                  <Text className="mt-1 font-semibold">{staffNames[request.applicantUserId] || "No identificado"}</Text>
                </View>
              </View>
              <View className="grid grid-cols-2 gap-4">
                <View className="rounded-xl border border-border p-4">
                  <Text className="mb-3 text-lg font-bold">Información del solicitante</Text>
                  {Object.entries(request.applicantData || {}).map(([key, value]) => (
                    <View key={key} className="mb-2 border-b border-border/50 pb-2">
                      <Text className="text-xs font-semibold uppercase text-muted-foreground">{key.replaceAll("_", " ")}</Text>
                      <Text className="mt-1">{formatRequestValue(value)}</Text>
                    </View>
                  ))}
                  {!Object.keys(request.applicantData || {}).length ? <Text className="text-muted-foreground">Sin información disponible.</Text> : null}
                </View>
                <View className="rounded-xl border border-border p-4">
                  <Text className="mb-3 text-lg font-bold">Información del trámite</Text>
                  {Object.entries(request.requestData || {}).map(([key, value]) => (
                    <View key={key} className="mb-2 border-b border-border/50 pb-2">
                      <Text className="text-xs font-semibold uppercase text-muted-foreground">{key.replaceAll("_", " ")}</Text>
                      <Text className="mt-1">{formatRequestValue(value)}</Text>
                    </View>
                  ))}
                  {!Object.keys(request.requestData || {}).length ? <Text className="text-muted-foreground">Sin información disponible.</Text> : null}
                </View>
              </View>
              <Text className="mt-2 text-lg font-bold">Actualizar seguimiento</Text>
              <View className="grid grid-cols-[260px_1fr_auto] items-end gap-3">
                <View className="gap-2">
                  <Text className="text-sm font-semibold">Nuevo estatus</Text>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [request.id]: {
                          ...draft,
                          status: event.currentTarget.value,
                        },
                      }))
                    }
                    style={{
                      minHeight: 40,
                      border: "1px solid #d4d4d8",
                      borderRadius: 8,
                      padding: "8px 12px",
                      background: "transparent",
                      color: "inherit",
                    }}
                  >
                    {REQUEST_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {REQUEST_STATUS_LABELS[status] || status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </View>
                <Field
                  label="Comentario de atención"
                  value={draft.comment}
                  onChangeText={(comment) =>
                    setDrafts((current) => ({
                      ...current,
                      [request.id]: { ...draft, comment },
                    }))
                  }
                  placeholder="Describe la atención o resolución"
                />
                {draft.status === "rechazada" || draft.status === "cancelada" ? (
                  <Field
                    label="Motivo por el que no continuó"
                    value={draft.discontinuationReason}
                    onChangeText={(discontinuationReason) =>
                      setDrafts((current) => ({
                        ...current,
                        [request.id]: { ...draft, discontinuationReason },
                      }))
                    }
                    placeholder="Motivo obligatorio"
                  />
                ) : null}
                {draft.status === "concluida" ? (
                  <View className="gap-3 rounded-xl bg-muted/50 p-4">
                    <Text className="font-semibold">¿Recibió el apoyo, trámite o beneficio?</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {[true, false].map((receivedBenefit) => (
                        <Pressable
                          key={String(receivedBenefit)}
                          onPress={() => setDrafts((current) => ({
                            ...current,
                            [request.id]: { ...draft, receivedBenefit },
                          }))}
                          className={`rounded-lg border px-4 py-2 ${draft.receivedBenefit === receivedBenefit ? "border-primary bg-primary/10" : "border-border"}`}
                        >
                          <Text>{receivedBenefit ? "Sí, fue beneficiario" : "No recibió beneficio"}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Field
                      label="Detalle del resultado"
                      value={draft.benefitDetail}
                      onChangeText={(benefitDetail) => setDrafts((current) => ({
                        ...current,
                        [request.id]: { ...draft, benefitDetail },
                      }))}
                      placeholder="Describe qué recibió o por qué concluyó sin beneficio"
                    />
                  </View>
                ) : null}
                <Button
                  disabled={
                    update.isPending ||
                    ((draft.status === "rechazada" || draft.status === "cancelada") && !draft.discontinuationReason.trim()) ||
                    (draft.status === "concluida" && typeof draft.receivedBenefit !== "boolean")
                  }
                  onPress={() => update.mutate({ id: request.id })}
                >
                  <Text>
                    {update.isPending ? "Guardando..." : "Actualizar"}
                  </Text>
                </Button>
              </View>
              {!request.reassignmentRequired ? (
                <View className="gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <View>
                    <Text className="font-semibold text-amber-900">¿El trámite no corresponde a tu unidad?</Text>
                    <Text className="text-sm text-amber-800">Envíalo al Enlace para que revise el expediente y lo canalice correctamente.</Text>
                  </View>
                  <Field
                    label="Motivo de no aplicación"
                    value={reassignmentReasons[request.id] || ""}
                    onChangeText={(reason) => setReassignmentReasons((current) => ({ ...current, [request.id]: reason }))}
                    placeholder="Explica por qué no aplica y qué atención parece requerir"
                  />
                  <View className="items-start">
                    <Button
                      variant="outline"
                      disabled={requestReassignment.isPending || !reassignmentReasons[request.id]?.trim()}
                      onPress={() => requestReassignment.mutate({ id: request.id, reason: reassignmentReasons[request.id] })}
                    >
                      <Text>Marcar “No aplica” y solicitar canalización</Text>
                    </Button>
                  </View>
                </View>
              ) : (
                <Text className="rounded-xl bg-amber-100 p-3 font-semibold text-amber-900">Pendiente de canalización por el Enlace</Text>
              )}
            </View>
          );
        }) : null}
        {!requests.isLoading && !requests.data?.length ? (
          <Text className="py-16 text-center text-muted-foreground">
            No hay solicitudes asignadas a tu unidad.
          </Text>
        ) : null}
      </ScrollView>
      </View>
    </View>
  );
}

function EnlaceDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const queue = useQuery({
    queryKey: ["enlace", "reassignment-queue"],
    queryFn: identityApi.listReassignmentQueue,
  });
  const units = useQuery({ queryKey: ["enlace", "units"], queryFn: adminService.listUnits });
  const services = useQuery({ queryKey: ["enlace", "services"], queryFn: adminService.listServices });
  const unitNames = useMemo(() => Object.fromEntries((units.data || []).map((unit) => [unit.id, unit.name])), [units.data]);
  const serviceNames = useMemo(() => Object.fromEntries((services.data || []).map((service) => [service.id, service.name])), [services.data]);
  const reassign = useMutation({
    mutationFn: ({ requestId, unitId }: { requestId: string; unitId: string }) =>
      identityApi.reassignRequest(requestId, unitId, comments[requestId]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enlace", "reassignment-queue"] });
      setNotice("Solicitud canalizada correctamente a la unidad responsable.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });

  return (
    <View className="h-screen flex-row bg-muted/30">
      <OperationalSidebar active="canalizacion" title="Enlace institucional" />
      <View className="flex-1 overflow-hidden">
      <View className="flex-row items-center justify-between border-b border-border bg-card px-8 py-5">
        <View>
          <Text className="text-2xl font-bold">Mesa de canalización</Text>
          <Text className="mt-1 text-sm text-muted-foreground">{user?.nombre} · Revisión de solicitudes que no aplican en su unidad original</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 32, gap: 16 }}>
        <View className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <Text className="text-lg font-bold">Función del Enlace</Text>
          <Text className="mt-1 text-muted-foreground">Lee el motivo y los datos del expediente, identifica la unidad competente y canaliza la solicitud. El movimiento queda registrado en el historial.</Text>
        </View>
        {notice ? <Text className="rounded-xl bg-primary/10 p-3 text-primary">{notice}</Text> : null}
        {queue.isLoading || units.isLoading || services.isLoading ? <ActivityIndicator color="#981646" /> : null}
        {(queue.data?.requests || []).map((request) => (
          <View key={request.id} className="gap-4 rounded-2xl border border-border bg-card p-5">
            <View className="flex-row justify-between gap-4">
              <View className="flex-1">
                <Text className="text-lg font-bold">{request.folio}</Text>
                <Text className="mt-1 text-sm text-muted-foreground">{serviceNames[request.serviceId] || "Trámite no identificado"} · Unidad actual: {unitNames[request.unitId] || request.unitId}</Text>
              </View>
              <Text className="font-semibold text-amber-700">Requiere canalización</Text>
            </View>
            <View className="rounded-xl bg-amber-50 p-4">
              <Text className="text-xs font-bold text-amber-900">MOTIVO DEL GESTOR</Text>
              <Text className="mt-1 text-amber-900">{request.reassignmentReason}</Text>
            </View>
            <View className="grid grid-cols-2 gap-4">
              <View className="rounded-xl border border-border p-4">
                <Text className="mb-3 font-bold">Datos de la persona solicitante</Text>
                {Object.entries(request.applicantData || {}).map(([key, value]) => (
                  <Text key={key} className="mb-1 text-sm"><Text className="font-semibold">{key.replaceAll("_", " ")}:</Text> {String(value || "—")}</Text>
                ))}
              </View>
              <View className="rounded-xl border border-border p-4">
                <Text className="mb-3 font-bold">Datos del trámite solicitado</Text>
                {Object.entries(request.requestData || {}).map(([key, value]) => (
                  <Text key={key} className="mb-1 text-sm"><Text className="font-semibold">{key.replaceAll("_", " ")}:</Text> {String(value || "—")}</Text>
                ))}
              </View>
            </View>
            <View className="gap-2">
              <Text className="text-sm font-semibold">Canalizar a</Text>
              <select
                value={destinations[request.id] || ""}
                onChange={(event) => setDestinations((current) => ({ ...current, [request.id]: event.currentTarget.value }))}
                className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"
              >
                <option value="">Selecciona la unidad responsable</option>
                {(units.data || []).filter((unit) => unit.id !== request.unitId && unit.active).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </View>
            <Field label="Nota de canalización" value={comments[request.id] || ""} onChangeText={(comment) => setComments((current) => ({ ...current, [request.id]: comment }))} placeholder="Criterio utilizado para la reasignación" />
            <View className="items-end">
              <Button disabled={!destinations[request.id] || reassign.isPending} onPress={() => reassign.mutate({ requestId: request.id, unitId: destinations[request.id] })}>
                <Text>{reassign.isPending ? "Canalizando..." : "Confirmar canalización"}</Text>
              </Button>
            </View>
          </View>
        ))}
        {!queue.isLoading && !queue.data?.requests.length ? <Text className="py-16 text-center text-muted-foreground">No hay solicitudes pendientes de canalización.</Text> : null}
      </ScrollView>
      </View>
    </View>
  );
}

function SecretaryDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [section, setSection] = useState<SecretarySection>("resumen");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const requests = useQuery({
    queryKey: ["secretaria", "requests"],
    queryFn: requestsService.listAllAccessible,
  });
  const services = useQuery({
    queryKey: ["secretaria", "services"],
    queryFn: adminService.listServices,
  });
  const events = useQuery({
    queryKey: ["secretaria", "events"],
    queryFn: adminService.listEvents,
  });
  const units = useQuery({
    queryKey: ["secretaria", "units"],
    queryFn: adminService.listUnits,
  });
  const reportingStaff = useQuery({
    queryKey: ["secretaria", "reporting-staff"],
    queryFn: identityApi.getReportingStaff,
  });
  const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
  const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity;
  const periodDescription = from && to
    ? `Periodo seleccionado: ${new Date(`${from}T00:00:00`).toLocaleDateString("es-MX")} al ${new Date(`${to}T00:00:00`).toLocaleDateString("es-MX")}.`
    : from
      ? `Mostrando resultados desde el ${new Date(`${from}T00:00:00`).toLocaleDateString("es-MX")}.`
      : to
        ? `Mostrando resultados hasta el ${new Date(`${to}T00:00:00`).toLocaleDateString("es-MX")}.`
        : "Sin filtro de fechas: mostrando todo el historial disponible.";
  const filteredRequests = useMemo(
    () => (requests.data || []).filter((request) => {
      const time = new Date(request.requestedAt).getTime();
      return time >= fromTime && time <= toTime;
    }),
    [requests.data, fromTime, toTime],
  );
  const filteredEvents = useMemo(
    () => (events.data || []).filter((event) => {
      const startsAt = new Date(event.startsAt).getTime();
      const endsAt = new Date(event.endsAt || event.startsAt).getTime();
      return startsAt <= toTime && endsAt >= fromTime;
    }),
    [events.data, fromTime, toTime],
  );
  const serviceNames = useMemo(
    () => Object.fromEntries((services.data || []).map((service) => [service.id, service.name])),
    [services.data],
  );
  const unitNames = useMemo(
    () => Object.fromEntries((units.data || []).map((unit) => [unit.id, unit.name])),
    [units.data],
  );
  const eventNames = useMemo(
    () => Object.fromEntries((events.data || []).map((event) => [event.id, event.name])),
    [events.data],
  );
  const staffNames = useMemo(
    () => Object.fromEntries((reportingStaff.data?.staff || []).map((member) => [member.id, member.name])),
    [reportingStaff.data],
  );
  const capturistaRanking = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of filteredRequests)
      counts.set(request.applicantUserId, (counts.get(request.applicantUserId) || 0) + 1);
    return [...counts.entries()]
      .map(([id, count]) => ({ id, name: staffNames[id] || "Capturista no identificado", count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRequests, staffNames]);
  const eventRequestCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of filteredRequests)
      if (request.eventId) counts.set(request.eventId, (counts.get(request.eventId) || 0) + 1);
    return counts;
  }, [filteredRequests]);
  const eventRequestCountRecord = useMemo(
    () => Object.fromEntries(eventRequestCounts.entries()),
    [eventRequestCounts],
  );
  const ranking = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of filteredRequests)
      counts.set(request.serviceId, (counts.get(request.serviceId) || 0) + 1);
    return (services.data || [])
      .map((service) => ({ name: service.name, count: counts.get(service.id) || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [filteredRequests, services.data]);
  const statusChart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of filteredRequests)
      counts.set(request.status, (counts.get(request.status) || 0) + 1);
    return [...counts.entries()]
      .map(([status, value]) => ({ label: REQUEST_STATUS_LABELS[status] || status, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRequests]);
  const eventChart = useMemo(
    () => filteredEvents
      .map((event) => ({ label: event.name, value: eventRequestCounts.get(event.id) || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
    [filteredEvents, eventRequestCounts],
  );
  const changed = filteredRequests.filter((request) => request.status !== "enviada").length;
  const concluded = filteredRequests.filter((request) => request.status === "concluida").length;
  const didNotContinue = filteredRequests.filter((request) => request.status === "rechazada" || request.status === "cancelada").length;
  const beneficiaries = filteredRequests.filter((request) => request.receivedBenefit === true).length;
  const priority = filteredRequests.filter((request) => request.priorityOnReopening).length;
  const loading = requests.isLoading || services.isLoading || events.isLoading || units.isLoading || reportingStaff.isLoading;
  const exportCsv = () => {
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = filteredRequests.map((request) => [
      request.folio,
      serviceNames[request.serviceId] || request.serviceId,
      unitNames[request.unitId] || request.unitId,
      request.eventId ? eventNames[request.eventId] || request.eventFolio : "Sin evento",
      new Date(request.requestedAt).toLocaleString("es-MX"),
      request.status.replaceAll("_", " "),
      request.status === "enviada" ? "No" : "Sí",
      staffNames[request.applicantUserId] || "No identificado",
      request.priorityOnReopening ? "Sí" : "No",
      request.finalResult || "",
    ]);
    const csv = [
      ["Folio", "Trámite", "Unidad", "Evento", "Fecha", "Estatus actual", "Estatus modificado", "Capturista", "Prioridad reapertura", "Resultado final"],
      ...rows,
    ].map((row) => row.map(escape).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = `reporte-secretaria-${from || "inicio"}-${to || "hoy"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <View className="h-screen flex-row bg-muted/30">
      <View className="w-72 border-r border-border bg-card p-5">
        <View className="mb-8 border-b border-border pb-5">
          <Text className="text-xl font-bold text-primary">Jornadas</Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            Panel de Secretaría
          </Text>
        </View>
        <View className="gap-2">
          {secretaryNav.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setSection(item.key)}
              className={`flex-row items-center gap-3 rounded-xl px-4 py-3 ${section === item.key ? "bg-primary" : "hover:bg-muted"}`}
            >
              <Text className={section === item.key ? "text-primary-foreground" : "text-muted-foreground"}>
                {item.icon}
              </Text>
              <Text className={`font-medium ${section === item.key ? "text-primary-foreground" : ""}`}>
                {item.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => router.push("/home" as any)}
            className="mt-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
          >
            <Text className="font-semibold text-primary">＋ Nueva captura</Text>
            <Text className="mt-1 text-xs text-muted-foreground">Registrar solicitud asistida</Text>
          </Pressable>
        </View>
        <View className="mt-auto border-t border-border pt-5">
          <Text className="font-semibold">{user?.nombre}</Text>
          <Text className="mb-4 mt-1 text-xs text-muted-foreground">
            Secretaría · Consulta general
          </Text>
          <Button variant="outline" onPress={logout}><Text>Cerrar sesión</Text></Button>
        </View>
      </View>

      <View className="flex-1">
        <View className="flex-row items-center justify-between border-b border-border bg-background px-8 py-5">
          <View>
            <Text className="text-2xl font-bold">
              {secretaryNav.find((item) => item.key === section)?.label}
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Secretaría de Turismo y Desarrollo Económico
            </Text>
          </View>
          {section === "solicitudes" ? (
            <Button disabled={!filteredRequests.length} onPress={exportCsv}>
              <Text>Exportar CSV</Text>
            </Button>
          ) : null}
        </View>
        <ScrollView contentContainerStyle={{ padding: 32, gap: 24 }}>
        <View className="flex-row flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5">
          <View className="gap-2"><Text className="text-sm font-semibold">Desde</Text><input type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2" /></View>
          <View className="gap-2"><Text className="text-sm font-semibold">Hasta</Text><input type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2" /></View>
          <Button variant="outline" onPress={() => { setFrom(""); setTo(""); }}><Text>Limpiar filtro</Text></Button>
          <Text className="ml-auto text-xs font-medium text-muted-foreground">{periodDescription}</Text>
        </View>
        {loading ? <ActivityIndicator color="#981646" /> : null}
        {section === "resumen" ? <>
          <View className="flex-row flex-wrap gap-4">
            <Metric label="Solicitudes registradas" value={filteredRequests.length} note="En el periodo seleccionado" />
            <Metric label="Eventos realizados" value={filteredEvents.length} note="Ubicados en el mapa" />
            <Metric label="Con cambio de estatus" value={changed} note="Solicitudes que ya recibieron atención" />
            <Metric label="Concluidas" value={concluded} note={`${beneficiaries} personas beneficiarias`} />
            <Metric label="No continuaron" value={didNotContinue} note="Rechazadas o canceladas con motivo" />
            <Metric label="Prioridad al reabrir" value={priority} note="Registradas fuera de convocatoria" />
          </View>
          <View className="flex-row flex-wrap gap-4">
            <HorizontalBarChart title="Solicitudes por estatus" data={statusChart} />
            <HorizontalBarChart title="Trámites más solicitados" data={ranking.slice(0, 6).map((item) => ({ label: item.name, value: item.count }))} />
            <HorizontalBarChart title="Solicitudes por evento" data={eventChart} />
          </View>
          <View className="rounded-2xl border border-border bg-card p-5">
            <Text className="text-xl font-bold">Productividad de capturistas</Text>
            <Text className="mb-4 mt-1 text-sm text-muted-foreground">Solicitudes registradas durante el periodo seleccionado.</Text>
            <View className="gap-2">
              {capturistaRanking.map((capturista, index) => (
                <View key={capturista.id} className="flex-row items-center rounded-xl bg-muted/50 p-3">
                  <Text className="w-10 font-bold text-primary">#{index + 1}</Text>
                  <Text className="flex-1 font-semibold">{capturista.name}</Text>
                  <Text>{capturista.count} solicitudes</Text>
                </View>
              ))}
              {!capturistaRanking.length ? <Text className="text-muted-foreground">Sin capturas en este periodo.</Text> : null}
            </View>
          </View>
          <View className="flex-row flex-wrap gap-4">
            <View className="min-w-72 flex-1 rounded-2xl border border-border bg-card p-5">
              <Text className="text-sm text-muted-foreground">Trámite más solicitado</Text>
              <Text className="mt-2 text-xl font-bold">{ranking[0]?.name || "Sin datos"}</Text>
              <Text className="mt-1 text-primary">{ranking[0]?.count || 0} solicitudes</Text>
            </View>
            <View className="min-w-72 flex-1 rounded-2xl border border-border bg-card p-5">
              <Text className="text-sm text-muted-foreground">Trámite menos solicitado</Text>
              <Text className="mt-2 text-xl font-bold">{ranking.at(-1)?.name || "Sin datos"}</Text>
              <Text className="mt-1 text-primary">{ranking.at(-1)?.count || 0} solicitudes</Text>
            </View>
          </View>
        </> : null}
        {section === "eventos" ? <>
          <View className="rounded-2xl border border-border bg-card p-5">
            <Text className="mb-1 text-xl font-bold">Mapa de eventos en Tabasco</Text>
            <Text className="mb-4 text-sm text-muted-foreground">Selecciona un marcador para consultar lugar, fecha y folio.</Text>
            <Suspense fallback={<ActivityIndicator color="#981646" />}><SecretaryEventsMap events={filteredEvents as AttentionEvent[]} requestCounts={eventRequestCountRecord} /></Suspense>
          </View>
          <View className="rounded-2xl border border-border bg-card p-5">
          <Text className="mb-4 text-xl font-bold">Eventos del periodo</Text>
          <View className="gap-2">
            {filteredEvents.map((event) => (
              <View key={event.id} className="grid grid-cols-[1.5fr_1fr_1fr_auto] items-center gap-3 rounded-xl bg-muted/50 p-3">
                <View><Text className="font-semibold">{event.name}</Text><Text className="text-xs text-muted-foreground">{event.folioPrefix} · {eventRequestCounts.get(event.id) || 0} solicitudes</Text></View>
                <Text>{event.locality}, {event.municipality}</Text>
                <Text>{formatEventDateTime(event.startsAt)}</Text>
                <Text className={getEventStatus(event) === "Activo" ? "text-green-700" : "text-muted-foreground"}>{getEventStatus(event)}</Text>
              </View>
            ))}
            {!filteredEvents.length ? <Text className="py-6 text-center text-muted-foreground">No hay eventos en el rango seleccionado.</Text> : null}
          </View>
          </View>
        </> : null}
        {section === "solicitudes" ? <View className="rounded-2xl border border-border bg-card p-5">
          <Text className="mb-4 text-xl font-bold">Detalle de solicitudes</Text>
          <View className="gap-2">
            {filteredRequests.map((request) => (
              <View key={request.id} className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr_auto] items-center gap-3 rounded-xl bg-muted/50 p-3">
                <View><Text className="font-semibold">{request.folio}</Text><Text className="text-xs text-muted-foreground">{new Date(request.requestedAt).toLocaleDateString("es-MX")}</Text></View>
                <Text>{serviceNames[request.serviceId] || "Trámite no disponible"}</Text>
                <Text>{unitNames[request.unitId] || "Unidad no disponible"}</Text>
                <Text className="capitalize">{request.status.replaceAll("_", " ")}</Text>
                <Text className={request.status === "enviada" ? "text-muted-foreground" : "text-green-700"}>{request.status === "enviada" ? "Sin cambio" : "Modificado"}</Text>
              </View>
            ))}
            {!filteredRequests.length ? <Text className="py-6 text-center text-muted-foreground">No hay solicitudes en el rango seleccionado.</Text> : null}
          </View>
        </View> : null}
        </ScrollView>
      </View>
    </View>
  );
}

function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("resumen");
  const [serviceModal, setServiceModal] = useState(false);
  const [unitModal, setUnitModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [form, setForm] = useState<ServiceInput>(EMPTY);
  const [requirements, setRequirements] = useState<ServiceRequirementInput[]>([]);
  const [unitForm, setUnitForm] = useState({
    id: "",
    code: "",
    name: "",
    description: "",
    contactEmail: "",
    active: true,
  });
  const [specificFieldsDraft, setSpecificFieldsDraft] = useState<
    ServiceFormField[]
  >([]);
  const [serviceImage, setServiceImage] = useState<File | null>(null);
  const [invite, setInvite] = useState<{
    id: string;
    name: string;
    email: string;
    password: string;
    unitId: string;
    role: "secretaria" | "enlace" | "gestor" | "capturista";
    active: boolean;
  }>({ id: "", name: "", email: "", password: "", unitId: "", role: "capturista", active: true });
  const [eventForm, setEventForm] = useState<AttentionEventInput>(EMPTY_EVENT);
  const [globalFieldsDraft, setGlobalFieldsDraft] = useState<
    ServiceFormField[]
  >([]);
  const [ineAnalysisEnabled, setIneAnalysisEnabled] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [solicitudesEventFilter, setSolicitudesEventFilter] =
    useState<string>("");

  const units = useQuery({
    queryKey: ["admin", "units"],
    queryFn: adminService.listUnits,
  });
  const services = useQuery({
    queryKey: ["admin", "services"],
    queryFn: adminService.listServices,
  });
  const profiles = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: adminService.listProfiles,
  });
  const requests = useQuery({
    queryKey: ["admin", "requests"],
    queryFn: requestsService.listAccessible,
  });
  const events = useQuery({
    queryKey: ["admin", "events"],
    queryFn: adminService.listEvents,
  });
  const globalForm = useQuery({
    queryKey: ["admin", "global-form"],
    queryFn: adminService.getGlobalForm,
  });
  const unitNames = useMemo(
    () =>
      Object.fromEntries(
        (units.data || []).map((unit) => [unit.id, unit.name]),
      ),
    [units.data],
  );

  const save = useMutation({
    mutationFn: async () => {
      let image = {
        imageFileId: form.imageFileId,
        imageUrl: form.imageUrl,
      };
      if (serviceImage) {
        const uploaded = await filesService.uploadImage(
          serviceImage,
          "catalog_images",
        );
        image = { imageFileId: uploaded.filename, imageUrl: uploaded.url };
      }
      return adminService.saveService({
        ...form,
        ...image,
        requirements: requirements.map((item) => ({
          ...item,
          name: item.name.trim(),
          description: item.description?.trim(),
          documentType: item.documentType?.trim(),
        })),
        formConfig: {
          fields: specificFieldsDraft.map((field) => ({
            ...field,
            label: field.label.trim(),
            placeholder: field.placeholder?.trim(),
            options: field.options
              ?.map((option) => option.trim())
              .filter(Boolean),
          })),
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "services"] });
      await queryClient.invalidateQueries({ queryKey: ["catalog"] });
      setServiceModal(false);
      setNotice("Trámite guardado correctamente.");
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const saveUnit = useMutation({
    mutationFn: () => identityApi.saveAdministrativeUnit({
      ...unitForm,
      id: unitForm.id || undefined,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "units"] });
      await queryClient.invalidateQueries({ queryKey: ["catalog"] });
      setUnitModal(false);
      setNotice("Unidad administrativa guardada correctamente.");
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const createUser = useMutation({
    mutationFn: () => invite.id
      ? identityApi.updateStaffUser({ ...invite, id: invite.id })
      : adminService.createStaffUser(invite),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
      setUserModal(false);
      setInvite({
        id: "",
        name: "",
        email: "",
        password: "",
        unitId: "",
        role: "capturista",
        active: true,
      });
      setNotice("Usuario guardado y relacionado correctamente.");
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const saveEvent = useMutation({
    mutationFn: () => adminService.saveEvent(eventForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      setEventModal(false);
      setNotice("Evento de atención guardado correctamente.");
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const finishEvent = useMutation({
    mutationFn: (eventId: string) => identityApi.finishEvent(eventId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      setNotice("Evento finalizado. Ya no recibirá nuevas solicitudes.");
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const saveGlobalForm = useMutation({
    mutationFn: () => {
      if (!globalForm.data)
        throw new Error("No se cargó la configuración global");
      return adminService.saveGlobalForm({
        ...globalForm.data,
        version: globalForm.data.version + 1,
        enableINEAnalysis: ineAnalysisEnabled,
        fields: globalFieldsDraft.map((field) => ({
          ...field,
          label: field.label.trim(),
          placeholder: field.placeholder?.trim(),
          options: field.options
            ?.map((option) => option.trim())
            .filter(Boolean),
        })),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "global-form"],
      });
      setNotice("Formulario global actualizado.");
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const openNew = () => {
    setForm({ ...EMPTY, unitId: units.data?.[0]?.id || "" });
    setRequirements([]);
    setSpecificFieldsDraft([]);
    setServiceImage(null);
    setServiceModal(true);
  };
  const openNewUnit = () => {
    setUnitForm({ id: "", code: "", name: "", description: "", contactEmail: "", active: true });
    setUnitModal(true);
    setNotice(null);
  };
  const openEdit = async (item: ProcedureService) => {
    const reqs = await adminService.listRequirements(item.id);
    setForm({
      ...item,
      programFolioPrefix: item.programFolioPrefix || item.code,
      requirements: reqs.map((x) => x.name),
    });
    setRequirements(reqs.map((item) => ({
      name: item.name,
      description: item.description || "",
      documentType: item.documentType || "",
      required: item.required,
    })));
    setSpecificFieldsDraft(
      (item.formConfig?.fields || []).map((field, index) => ({
        ...field,
        key: field.key || `pregunta_${Date.now()}_${index + 1}`,
      })),
    );
    setServiceImage(null);
    setServiceModal(true);
  };
  const openGlobalForm = () => {
    setIneAnalysisEnabled(Boolean(globalForm.data?.enableINEAnalysis));
    setGlobalFieldsDraft(
      (globalForm.data?.fields || []).map((field, index) => ({
        ...field,
        key: field.key || `pregunta_${Date.now()}_${index + 1}`,
        options:
          field.type === "select" &&
          `${field.key} ${field.label}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .includes("municipio") &&
          !field.options?.length
            ? [...TABASCO_MUNICIPALITIES]
            : field.options,
      })),
    );
  };
  const openNewEvent = () => {
    setEventForm({ ...EMPTY_EVENT });
    setEventModal(true);
    setNotice(null);
  };
  const serviceValidationErrors = [
    !form.programFolioPrefix?.trim() ? "Prefijo del folio" : null,
    !form.name.trim() ? "Nombre" : null,
    !form.description.trim() ? "Descripción" : null,
    !form.targetAudience?.trim() ? "Población objetivo" : null,
    !form.cost?.trim() ? "Costo del trámite o indicar que es gratuito" : null,
    !form.unitId ? "Unidad administrativa" : null,
    !requirements.length ? "Al menos un requisito" : null,
    requirements.some((item) => !item.name.trim())
      ? "Nombre de todos los requisitos"
      : null,
    !isFormBuilderValid(specificFieldsDraft)
      ? "Preguntas del formulario propio completas"
      : null,
  ].filter(Boolean) as string[];
  const loading =
    units.isLoading ||
    services.isLoading ||
    profiles.isLoading ||
    requests.isLoading ||
    events.isLoading ||
    globalForm.isLoading;

  return (
    <View className="h-screen flex-row bg-muted/30">
      <View className="w-72 border-r border-border bg-card p-5">
        <View className="mb-8 border-b border-border pb-5">
          <Text className="text-xl font-bold text-primary">Jornadas</Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            Panel de administración
          </Text>
        </View>
        <View className="gap-2">
          {nav.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => {
                setSection(item.key);
                setNotice(null);
                if (item.key === "formulario") openGlobalForm();
              }}
              className={`flex-row items-center gap-3 rounded-xl px-4 py-3 ${section === item.key ? "bg-primary" : "hover:bg-muted"}`}
            >
              <Text
                className={
                  section === item.key
                    ? "text-primary-foreground"
                    : "text-muted-foreground"
                }
              >
                {item.icon}
              </Text>
              <Text
                className={`font-medium ${section === item.key ? "text-primary-foreground" : ""}`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => router.push("/home" as any)}
            className="mt-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
          >
            <Text className="font-semibold text-primary">＋ Nueva captura</Text>
            <Text className="mt-1 text-xs text-muted-foreground">Registrar solicitud asistida</Text>
          </Pressable>
        </View>
        <View className="mt-auto border-t border-border pt-5">
          <Text className="font-semibold">{user?.nombre}</Text>
          <Text className="mb-4 mt-1 text-xs text-muted-foreground">
            Superadministrador
          </Text>
          <Button variant="outline" onPress={logout}>
            <Text>Cerrar sesión</Text>
          </Button>
        </View>
      </View>

      <View className="flex-1">
        <View className="flex-row items-center justify-between border-b border-border bg-background px-8 py-5">
          <View>
            <Text className="text-2xl font-bold">
              {nav.find((x) => x.key === section)?.label}
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Secretaría de Turismo y Desarrollo Económico
            </Text>
          </View>
          {section === "unidades" ? (
            <Button onPress={openNewUnit}>
              <Text>+ Nueva unidad</Text>
            </Button>
          ) : section === "tramites" ? (
            <Button onPress={openNew}>
              <Text>+ Nuevo trámite</Text>
            </Button>
          ) : section === "eventos" ? (
            <Button onPress={openNewEvent}>
              <Text>+ Nuevo evento</Text>
            </Button>
          ) : section === "usuarios" ? (
            <Button
              onPress={() => {
                setInvite({ id: "", name: "", email: "", password: "", unitId: units.data?.[0]?.id || "", role: "capturista", active: true });
                setUserModal(true);
              }}
            >
              <Text>+ Nuevo usuario</Text>
            </Button>
          ) : null}
        </View>
        {notice ? (
          <View className="mx-8 mt-5 rounded-xl border border-primary/30 bg-primary/10 p-3">
            <Text className="text-primary">{notice}</Text>
          </View>
        ) : null}
        <ScrollView contentContainerStyle={{ padding: 32, gap: 20 }}>
          {loading ? (
            <ActivityIndicator color="#981646" />
          ) : (
            <>
              {section === "resumen" && (
                <>
                  <View className="flex-row flex-wrap gap-4">
                    <Metric
                      label="Eventos de atención"
                      value={events.data?.length || 0}
                      note={`${events.data?.filter((x) => x.active).length || 0} activos`}
                    />
                    <Metric
                      label="Trámites y servicios"
                      value={services.data?.length || 0}
                      note={`${services.data?.filter((x) => x.active).length || 0} disponibles`}
                    />
                    <Metric
                      label="Usuarios"
                      value={profiles.data?.length || 0}
                      note={`${profiles.data?.filter((x) => x.role === "enlace").length || 0} enlaces`}
                    />
                    <Metric
                      label="Solicitudes"
                      value={requests.data?.length || 0}
                      note="Registros visibles"
                    />
                  </View>
                  <View className="rounded-2xl border border-border bg-card p-6">
                    <Text className="text-lg font-bold">Accesos rápidos</Text>
                    <View className="mt-4 flex-row flex-wrap gap-3">
                      <Button onPress={() => setSection("eventos")}>
                        <Text>Crear evento</Text>
                      </Button>
                      <Button
                        variant="outline"
                        onPress={() => setSection("tramites")}
                      >
                        <Text>Administrar trámites</Text>
                      </Button>
                      <Button
                        variant="outline"
                        onPress={() => {
                          setSection("formulario");
                          openGlobalForm();
                        }}
                      >
                        <Text>Formulario global</Text>
                      </Button>
                    </View>
                  </View>
                </>
              )}
              {section === "formulario" && (
                <View className="mx-auto w-full max-w-4xl gap-5 rounded-2xl border border-border bg-card p-7">
                  <View>
                    <Text className="text-xl font-bold">
                      Formulario general de solicitudes
                    </Text>
                    <Text className="mt-2 text-sm text-muted-foreground">
                      {`Estos campos se presentan en todos los trámites antes del formulario específico. Versión actual: ${globalForm.data?.version || 1}.`}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between rounded-xl border border-border bg-background p-4">
                    <View className="flex-1 pr-6">
                      <Text className="font-semibold">Analizar INE para autocompletar</Text>
                      <Text className="mt-1 text-xs text-muted-foreground">
                        Si se activa, el capturista podrá escanear la INE y completar campos compatibles como nombre, apellidos, CURP y domicilio.
                      </Text>
                    </View>
                    <Switch value={ineAnalysisEnabled} onValueChange={setIneAnalysisEnabled} />
                  </View>
                  {ineAnalysisEnabled && !globalFieldsDraft.some((field) =>
                    /nombre|apellido|curp|direccion|domicilio|genero|sexo|edad/i.test(`${field.key} ${field.label}`)
                  ) ? (
                    <View className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                      <Text className="text-sm text-amber-900">
                        Agrega al menos un campo de nombre, apellido, CURP, domicilio, sexo o edad para aprovechar el análisis de INE.
                      </Text>
                    </View>
                  ) : null}
                  <View className="gap-4">
                    {globalFieldsDraft.map((field, index) => (
                      <View
                        key={`${field.key}-${index}`}
                        className="gap-4 rounded-xl border border-border bg-background p-5"
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="font-bold">
                            Pregunta {index + 1}
                          </Text>
                          <View className="flex-row gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={index === 0}
                              onPress={() =>
                                setGlobalFieldsDraft((current) => {
                                  const next = [...current];
                                  [next[index - 1], next[index]] = [
                                    next[index],
                                    next[index - 1],
                                  ];
                                  return next;
                                })
                              }
                            >
                              <Text>↑</Text>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={index === globalFieldsDraft.length - 1}
                              onPress={() =>
                                setGlobalFieldsDraft((current) => {
                                  const next = [...current];
                                  [next[index], next[index + 1]] = [
                                    next[index + 1],
                                    next[index],
                                  ];
                                  return next;
                                })
                              }
                            >
                              <Text>↓</Text>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onPress={() =>
                                setGlobalFieldsDraft((current) =>
                                  current.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                            >
                              <Text>Eliminar</Text>
                            </Button>
                          </View>
                        </View>
                        <Field
                          label="Pregunta"
                          value={field.label}
                          onChangeText={(label) =>
                            setGlobalFieldsDraft((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, label } : item,
                              ),
                            )
                          }
                          placeholder="Ej. ¿Cuál es tu municipio?"
                        />
                        <View className="grid grid-cols-2 gap-4">
                          <View className="gap-2">
                            <Text className="text-sm font-semibold">
                              Tipo de respuesta
                            </Text>
                            <select
                              value={field.type || "text"}
                              onChange={(event) => {
                                const type = event.currentTarget
                                  .value as ServiceFormField["type"];
                                setGlobalFieldsDraft((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, type }
                                      : item,
                                  ),
                                );
                              }}
                              style={{
                                minHeight: 40,
                                border: "1px solid #d4d4d8",
                                borderRadius: 8,
                                padding: "8px 12px",
                                background: "transparent",
                                color: "inherit",
                              }}
                            >
                              <option value="text">Texto corto</option>
                              <option value="textarea">Texto largo</option>
                              <option value="number">Número</option>
                              <option value="email">Correo electrónico</option>
                              <option value="tel">Teléfono</option>
                              <option value="date">Fecha</option>
                              <option value="select">Selección única</option>
                              <option value="multiselect">
                                Selección múltiple
                              </option>
                              <option value="boolean">Sí / No</option>
                              <option value="file">Archivo o documento</option>
                            </select>
                          </View>
                          <Field
                            label="Texto de ayuda"
                            value={field.placeholder || ""}
                            onChangeText={(placeholder) =>
                              setGlobalFieldsDraft((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, placeholder }
                                    : item,
                                ),
                              )
                            }
                            placeholder="Indicación para responder"
                          />
                        </View>
                        {field.type === "select" ||
                        field.type === "multiselect" ? (
                          <View className="gap-3">
                            <Text className="text-sm font-semibold">
                              Opciones de respuesta
                            </Text>
                            {(field.options || []).map(
                              (option, optionIndex) => (
                                <View
                                  key={optionIndex}
                                  className="flex-row items-center gap-2"
                                >
                                  <View className="flex-1">
                                    <Input
                                      value={option}
                                      onChangeText={(value) =>
                                        setGlobalFieldsDraft((current) =>
                                          current.map((item, itemIndex) => {
                                            if (itemIndex !== index)
                                              return item;
                                            const options = [
                                              ...(item.options || []),
                                            ];
                                            options[optionIndex] = value;
                                            return { ...item, options };
                                          }),
                                        )
                                      }
                                      placeholder={`Opción ${optionIndex + 1}`}
                                    />
                                  </View>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={optionIndex === 0}
                                    onPress={() =>
                                      setGlobalFieldsDraft((current) =>
                                        current.map((item, itemIndex) => {
                                          if (itemIndex !== index) return item;
                                          const options = [
                                            ...(item.options || []),
                                          ];
                                          [
                                            options[optionIndex - 1],
                                            options[optionIndex],
                                          ] = [
                                            options[optionIndex],
                                            options[optionIndex - 1],
                                          ];
                                          return { ...item, options };
                                        }),
                                      )
                                    }
                                  >
                                    <Text>↑</Text>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      optionIndex ===
                                      (field.options?.length || 0) - 1
                                    }
                                    onPress={() =>
                                      setGlobalFieldsDraft((current) =>
                                        current.map((item, itemIndex) => {
                                          if (itemIndex !== index) return item;
                                          const options = [
                                            ...(item.options || []),
                                          ];
                                          [
                                            options[optionIndex],
                                            options[optionIndex + 1],
                                          ] = [
                                            options[optionIndex + 1],
                                            options[optionIndex],
                                          ];
                                          return { ...item, options };
                                        }),
                                      )
                                    }
                                  >
                                    <Text>↓</Text>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onPress={() =>
                                      setGlobalFieldsDraft((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                options: (
                                                  item.options || []
                                                ).filter(
                                                  (_, currentOptionIndex) =>
                                                    currentOptionIndex !==
                                                    optionIndex,
                                                ),
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                  >
                                    <Text>Quitar</Text>
                                  </Button>
                                </View>
                              ),
                            )}
                            <Button
                              variant="outline"
                              onPress={() =>
                                setGlobalFieldsDraft((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          options: [
                                            ...(item.options || []),
                                            "",
                                          ],
                                        }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <Text>+ Agregar opción</Text>
                            </Button>
                          </View>
                        ) : null}
                        <View className="flex-row items-center justify-between rounded-lg bg-muted p-3">
                          <View>
                            <Text className="font-semibold">
                              Pregunta obligatoria
                            </Text>
                            <Text className="text-xs text-muted-foreground">
                              Desactiva esta opción para que sea opcional.
                            </Text>
                          </View>
                          <Switch
                            value={field.required !== false}
                            onValueChange={(required) =>
                              setGlobalFieldsDraft((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, required }
                                    : item,
                                ),
                              )
                            }
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                  <Button
                    variant="outline"
                    onPress={() =>
                      setGlobalFieldsDraft((current) => [
                        ...current,
                        {
                          key: `pregunta_${Date.now()}_${current.length + 1}`,
                          label: "",
                          type: "text",
                          required: true,
                        },
                      ])
                    }
                  >
                    <Text>+ Agregar pregunta</Text>
                  </Button>
                  <View className="flex-row justify-end">
                    <Button
                      disabled={
                        saveGlobalForm.isPending ||
                        !globalFieldsDraft.length ||
                        globalFieldsDraft.some(
                          (field) =>
                            !field.key.trim() ||
                            !field.label.trim() ||
                            ((field.type === "select" ||
                              field.type === "multiselect") &&
                              (!field.options?.length ||
                                field.options.some(
                                  (option) => !option.trim(),
                                ) ||
                                new Set(
                                  field.options.map((option) =>
                                    option.trim().toLowerCase(),
                                  ),
                                ).size !== field.options.length)),
                        ) ||
                        new Set(globalFieldsDraft.map((field) => field.key))
                          .size !== globalFieldsDraft.length
                      }
                      onPress={() => saveGlobalForm.mutate()}
                    >
                      <Text>
                        {saveGlobalForm.isPending
                          ? "Guardando..."
                          : "Guardar formulario global"}
                      </Text>
                    </Button>
                  </View>
                </View>
              )}
              {section === "eventos" && (
                <View className="overflow-hidden rounded-2xl border border-border bg-card">
                  <View className="flex-row bg-muted px-5 py-3">
                    <Text className="flex-1 text-xs font-bold">
                      EVENTO / FOLIO
                    </Text>
                    <Text className="w-48 text-xs font-bold">
                      LOCALIDAD / MUNICIPIO
                    </Text>
                    <Text className="w-48 text-xs font-bold">FECHA Y HORA</Text>
                    <Text className="w-28 text-xs font-bold">ESTADO</Text>
                  </View>
                  {events.data?.length ? (
                    events.data.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          setEventForm(item);
                          setEventModal(true);
                        }}
                        className="flex-row items-center border-t border-border px-5 py-4 hover:bg-muted/40"
                      >
                        <View className="flex-1">
                          <Text className="font-semibold">{item.name}</Text>
                          <Text className="mt-1 text-xs text-muted-foreground">
                            Folio {item.folioPrefix}
                          </Text>
                        </View>
                        <View className="w-48">
                          <Text>{item.locality}</Text>
                          <Text className="mt-1 text-xs text-muted-foreground">
                            {item.municipality}
                          </Text>
                        </View>
                        <Text className="w-48 text-sm">
                          {formatEventDateTime(item.startsAt)}
                        </Text>
                        <View className="w-40 items-end gap-2">
                          <Text className={`font-semibold ${getEventStatus(item) === "Activo" ? "text-emerald-600" : "text-muted-foreground"}`}>
                            {getEventStatus(item)}
                          </Text>
                          {getEventStatus(item) !== "Finalizado" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={finishEvent.isPending}
                              onPress={(pressEvent) => {
                                pressEvent.stopPropagation();
                                finishEvent.mutate(item.id);
                              }}
                            >
                              <Text>Finalizar ahora</Text>
                            </Button>
                          ) : null}
                        </View>
                      </Pressable>
                    ))
                  ) : (
                    <Text className="p-10 text-center text-muted-foreground">
                      Todavía no hay eventos. Crea el primero para comenzar a
                      registrar atenciones.
                    </Text>
                  )}
                </View>
              )}
              {section === "unidades" && (
                <View className="overflow-hidden rounded-2xl border border-border bg-card">
                  <View className="flex-row bg-muted px-5 py-3">
                    <Text className="w-40 text-xs font-bold">CLAVE</Text>
                    <Text className="flex-1 text-xs font-bold">UNIDAD ADMINISTRATIVA</Text>
                    <Text className="w-72 text-xs font-bold">CONTACTO</Text>
                    <Text className="w-28 text-xs font-bold">ESTADO</Text>
                  </View>
                  {units.data?.length ? units.data.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setUnitForm({
                          id: item.id,
                          code: item.code,
                          name: item.name,
                          description: item.description || "",
                          contactEmail: item.contactEmail || "",
                          active: item.active,
                        });
                        setUnitModal(true);
                      }}
                      className="flex-row items-center border-t border-border px-5 py-4 hover:bg-muted/40"
                    >
                      <Text className="w-40 font-semibold">{item.code}</Text>
                      <View className="flex-1">
                        <Text className="font-semibold">{item.name}</Text>
                        <Text className="mt-1 text-xs text-muted-foreground">{item.description || "Sin descripción"}</Text>
                      </View>
                      <Text className="w-72 text-sm">{item.contactEmail || "—"}</Text>
                      <Text className={`w-28 font-semibold ${item.active ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {item.active ? "Activa" : "Inactiva"}
                      </Text>
                    </Pressable>
                  )) : (
                    <View className="items-center gap-3 p-10">
                      <Text className="font-semibold">No hay unidades administrativas</Text>
                      <Text className="text-center text-sm text-muted-foreground">Crea la primera unidad para poder registrar trámites y asignar gestores.</Text>
                      <Button onPress={openNewUnit}><Text>+ Crear primera unidad</Text></Button>
                    </View>
                  )}
                </View>
              )}
              {section === "tramites" && (
                <View className="overflow-hidden rounded-2xl border border-border bg-card">
                  <View className="flex-row bg-muted px-5 py-3">
                    <Text className="w-32 text-xs font-bold">CLAVE</Text>
                    <Text className="flex-1 text-xs font-bold">NOMBRE</Text>
                    <Text className="w-64 text-xs font-bold">UNIDAD</Text>
                    <Text className="w-28 text-xs font-bold">ESTADO</Text>
                  </View>
                  {services.data?.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => openEdit(item)}
                      className="flex-row items-center border-t border-border px-5 py-4 hover:bg-muted/40"
                    >
                      <Text className="w-32 text-sm font-semibold">
                        {item.code}
                      </Text>
                      <View className="flex-1">
                        <Text className="font-semibold">{item.name}</Text>
                        <Text className="mt-1 text-xs text-muted-foreground">
                          {item.type}
                        </Text>
                      </View>
                      <Text className="w-64 text-sm">
                        {unitNames[item.unitId] || item.unitId}
                      </Text>
                      <Text
                        className={`w-28 text-sm font-semibold ${item.active ? "text-emerald-600" : "text-muted-foreground"}`}
                      >
                        {item.active ? "Activo" : "Inactivo"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {section === "usuarios" && (
                <View className="overflow-hidden rounded-2xl border border-border bg-card">
                  <View className="flex-row bg-muted px-5 py-3">
                    <Text className="flex-1 text-xs font-bold">USUARIO</Text>
                    <Text className="w-48 text-xs font-bold">ROL</Text>
                    <Text className="w-72 text-xs font-bold">UNIDAD</Text>
                    <Text className="w-24 text-xs font-bold">ESTADO</Text>
                  </View>
                  {profiles.data?.map((item) => (
                    <Pressable
                      key={item.id}
                      disabled={item.role === "super_admin"}
                      onPress={() => {
                        if (item.role === "super_admin") return;
                        setInvite({
                          id: item.id,
                          name: item.name,
                          email: item.email,
                          password: "",
                          unitId: item.unitId || units.data?.[0]?.id || "",
                          role: item.role as "secretaria" | "enlace" | "gestor" | "capturista",
                          active: item.active,
                        });
                        setUserModal(true);
                      }}
                      className="flex-row items-center border-t border-border px-5 py-4"
                    >
                      <View className="flex-1">
                        <Text className="font-semibold">{item.name}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {item.email}
                        </Text>
                      </View>
                      <Text className="w-48 capitalize">
                        {item.role.replace("_", " ")}
                      </Text>
                      <Text className="w-72">
                        {item.unitId ? unitNames[item.unitId] : "Acceso global"}
                      </Text>
                      <Text
                        className={`w-24 font-semibold ${item.active ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {item.active ? "Activo" : "Inactivo"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {section === "solicitudes" && (
                <View className="gap-4">
                  {/* Filtro por evento */}
                  <View className="flex-row items-center gap-3">
                    <Text className="text-sm font-semibold">
                      Filtrar por evento:
                    </Text>
                    <select
                      value={solicitudesEventFilter}
                      onChange={(e) =>
                        setSolicitudesEventFilter(e.currentTarget.value)
                      }
                      style={{
                        minHeight: 36,
                        border: "1px solid #d4d4d8",
                        borderRadius: 8,
                        padding: "4px 10px",
                        background: "transparent",
                        color: "inherit",
                        minWidth: 260,
                      }}
                    >
                      <option value="">Todos los eventos</option>
                      {events.data?.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.name} · {event.municipality}
                        </option>
                      ))}
                    </select>
                    {solicitudesEventFilter && (
                      <Text className="text-xs text-muted-foreground">
                        {requests.data?.filter(
                          (r) => r.eventId === solicitudesEventFilter,
                        ).length ?? 0}{" "}
                        solicitudes
                      </Text>
                    )}
                  </View>
                  <View className="overflow-hidden rounded-2xl border border-border bg-card">
                    <View className="flex-row bg-muted px-5 py-3">
                      <Text className="flex-1 text-xs font-bold">FOLIO</Text>
                      <Text className="w-48 text-xs font-bold">
                        FOLIO EVENTO
                      </Text>
                      <Text className="w-64 text-xs font-bold">UNIDAD</Text>
                      <Text className="w-40 text-xs font-bold">FECHA</Text>
                      <Text className="w-44 text-xs font-bold">ESTATUS</Text>
                    </View>
                    {(() => {
                      const filtered = solicitudesEventFilter
                        ? (requests.data ?? []).filter(
                            (r) => r.eventId === solicitudesEventFilter,
                          )
                        : (requests.data ?? []);
                      if (!filtered.length) {
                        return (
                          <Text className="p-10 text-center text-muted-foreground">
                            {solicitudesEventFilter
                              ? "No hay solicitudes para este evento."
                              : "No hay solicitudes registradas."}
                          </Text>
                        );
                      }
                      return filtered.map((item) => (
                        <View
                          key={item.id}
                          className="flex-row border-t border-border px-5 py-4"
                        >
                          <Text className="flex-1 font-semibold">
                            {item.folio || item.programFolio || "—"}
                          </Text>
                          <Text className="w-48 text-sm text-muted-foreground">
                            {item.eventFolio || "—"}
                          </Text>
                          <Text className="w-64">
                            {unitNames[item.unitId] || item.unitId || "—"}
                          </Text>
                          <Text className="w-40">
                            {item.requestedAt
                              ? new Date(item.requestedAt).toLocaleDateString(
                                  "es-MX",
                                )
                              : "—"}
                          </Text>
                          <Text className="w-44 capitalize text-primary">
                            {(item.status ?? "").replaceAll("_", " ")}
                          </Text>
                        </View>
                      ));
                    })()}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={unitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-8">
          <View className="w-full max-w-2xl gap-5 rounded-2xl bg-background p-7">
            <View>
              <Text className="text-2xl font-bold">{unitForm.id ? "Editar" : "Nueva"} unidad administrativa</Text>
              <Text className="mt-1 text-sm text-muted-foreground">Los gestores y trámites se relacionarán con esta unidad.</Text>
            </View>
            <View className="grid grid-cols-[180px_1fr] gap-4">
              <Field
                label="Clave *"
                value={unitForm.code}
                onChangeText={(code) => setUnitForm({ ...unitForm, code: code.replace(/[^A-Za-z0-9_-]/g, "").toUpperCase() })}
                placeholder="Ej. PROMOCION"
              />
              <Field label="Nombre *" value={unitForm.name} onChangeText={(name) => setUnitForm({ ...unitForm, name })} placeholder="Ej. Dirección de Promoción Turística" />
            </View>
            <Field label="Descripción (opcional)" value={unitForm.description} onChangeText={(description) => setUnitForm({ ...unitForm, description })} />
            <Field label="Correo de contacto (opcional)" value={unitForm.contactEmail} onChangeText={(contactEmail) => setUnitForm({ ...unitForm, contactEmail })} placeholder="unidad@tabasco.gob.mx" />
            <View className="flex-row items-center justify-between rounded-xl bg-muted p-4">
              <View><Text className="font-semibold">Unidad activa</Text><Text className="text-xs text-muted-foreground">Las unidades activas pueden recibir trámites y gestores.</Text></View>
              <Switch value={unitForm.active} onValueChange={(active) => setUnitForm({ ...unitForm, active })} />
            </View>
            <View className="flex-row justify-end gap-3">
              <Button variant="outline" onPress={() => setUnitModal(false)}><Text>Cancelar</Text></Button>
              <Button
                disabled={saveUnit.isPending || !unitForm.code.trim() || !unitForm.name.trim()}
                onPress={() => saveUnit.mutate()}
              >
                <Text>{saveUnit.isPending ? "Guardando..." : "Guardar unidad"}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={serviceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setServiceModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-8">
          <View className="max-h-[90vh] w-full max-w-3xl rounded-2xl bg-background p-7">
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <Text className="text-2xl font-bold">
                {form.id ? "Editar" : "Nuevo"} trámite
              </Text>
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Field
                    label="Prefijo del folio"
                    value={form.programFolioPrefix || ""}
                    onChangeText={(value) => {
                      const prefix = value
                        .replace(/[^A-Za-z0-9]/g, "")
                        .toUpperCase();
                      setForm({
                        ...form,
                        code: prefix,
                        programFolioPrefix: prefix,
                      });
                    }}
                    placeholder="Ej. TANDAS"
                  />
                </View>
                <View className="flex-[2]">
                  <Field
                    label="Nombre"
                    value={form.name}
                    onChangeText={(name) => setForm({ ...form, name })}
                  />
                </View>
              </View>
              <Field
                label="Descripción"
                value={form.description}
                onChangeText={(description) =>
                  setForm({ ...form, description })
                }
              />
              <TargetAudienceBuilder
                value={form.targetAudience || ""}
                onChange={(targetAudience) =>
                  setForm({ ...form, targetAudience })
                }
              />
              <View className="gap-3 rounded-xl border border-border p-4">
                <View>
                  <Text className="font-bold">Costo del trámite *</Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    Indica si es gratuito o cuánto debe pagar la persona.
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setForm({ ...form, cost: "Gratuito" })}
                    className={`rounded-xl border px-4 py-3 ${form.cost === "Gratuito" ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    <Text className={form.cost === "Gratuito" ? "font-semibold text-primary" : ""}>Gratuito</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setForm({ ...form, cost: form.cost === "Gratuito" ? "" : form.cost })}
                    className={`rounded-xl border px-4 py-3 ${form.cost !== "Gratuito" ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    <Text className={form.cost !== "Gratuito" ? "font-semibold text-primary" : ""}>Tiene costo</Text>
                  </Pressable>
                </View>
                {form.cost !== "Gratuito" ? (
                  <Field
                    label="Monto o descripción del costo"
                    value={form.cost || ""}
                    onChangeText={(cost) => setForm({ ...form, cost })}
                    placeholder="Ej. $250.00 MXN"
                  />
                ) : null}
              </View>
              <View className="gap-2 rounded-xl border border-border p-4">
                <Text className="text-sm font-semibold">
                  Imagen del programa, servicio o trámite (opcional)
                </Text>
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt={form.name || "Imagen actual"}
                    style={{
                      width: 180,
                      height: 110,
                      objectFit: "cover",
                      borderRadius: 10,
                    }}
                  />
                ) : null}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setServiceImage(event.currentTarget.files?.[0] || null)
                  }
                />
                <Text className="text-xs text-muted-foreground">
                  JPG, PNG o WebP. Máximo 10 MB.
                </Text>
              </View>
              <View className="flex-row gap-2">
                {(["tramite", "servicio", "programa"] as ServiceType[]).map(
                  (type) => (
                    <Pressable
                      key={type}
                      onPress={() => setForm({ ...form, type })}
                      className={`rounded-lg border px-4 py-2 ${form.type === type ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      <Text className="capitalize">{type}</Text>
                    </Pressable>
                  ),
                )}
              </View>
              <UnitPicker
                units={units.data || []}
                value={form.unitId}
                onChange={(unitId) => setForm({ ...form, unitId })}
              />
              <View className="grid grid-cols-3 gap-4">
                <Field
                  label="Titular actual de la unidad (opcional)"
                  value={form.contactName || ""}
                  onChangeText={(contactName) =>
                    setForm({ ...form, contactName })
                  }
                />
                <Field
                  label="Correo de contacto (opcional)"
                  value={form.contactEmail || ""}
                  onChangeText={(contactEmail) =>
                    setForm({ ...form, contactEmail })
                  }
                  placeholder="titular@tabasco.gob.mx"
                />
                <Field
                  label="Número de celular (opcional)"
                  value={form.contactPhone || ""}
                  onChangeText={(contactPhone) =>
                    setForm({ ...form, contactPhone })
                  }
                  placeholder="993 000 0000"
                />
              </View>
              <View className="flex-row gap-4">
                <DateTimeField
                  label="Apertura (opcional)"
                  value={form.opensAt || ""}
                  onChange={(opensAt) => setForm({ ...form, opensAt })}
                />
                <DateTimeField
                  label="Cierre (opcional)"
                  value={form.closesAt || ""}
                  onChange={(closesAt) => setForm({ ...form, closesAt })}
                />
              </View>
              <RequirementBuilder
                requirements={requirements}
                onChange={setRequirements}
              />
              <View className="gap-3 rounded-xl border border-border p-4">
                <View>
                  <Text className="font-bold">
                    Formulario propio del trámite
                  </Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    Estas preguntas se mostrarán después del formulario global.
                  </Text>
                </View>
                <FormFieldBuilder
                  fields={specificFieldsDraft}
                  onChange={setSpecificFieldsDraft}
                />
              </View>
              <View className="rounded-xl border border-border p-4">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="font-semibold">
                      Usar formulario global
                    </Text>
                    <Text className="mt-1 text-xs text-muted-foreground">
                      Combina los datos generales con el formulario propio del
                      trámite.
                    </Text>
                  </View>
                  <Switch
                    value={form.usesGlobalForm ?? true}
                    onValueChange={(usesGlobalForm) =>
                      setForm({ ...form, usesGlobalForm })
                    }
                  />
                </View>
              </View>
              <View className="rounded-xl bg-primary/10 p-4">
                <Text className="text-sm font-semibold text-primary">
                  Ejemplo del próximo folio
                </Text>
                <Text className="mt-1 text-xl font-bold text-primary">
                  {form.programFolioPrefix || "TANDAS"}-000001
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold">Disponible</Text>
                <Switch
                  value={form.active}
                  onValueChange={(active) => setForm({ ...form, active })}
                />
              </View>
              {serviceValidationErrors.length ? (
                <View className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <Text className="font-semibold text-amber-900">
                    Falta completar para poder guardar:
                  </Text>
                  {serviceValidationErrors.map((field) => (
                    <Text key={field} className="mt-1 text-sm text-amber-800">
                      • {field}
                    </Text>
                  ))}
                </View>
              ) : (
                <View className="rounded-xl border border-green-300 bg-green-50 p-4">
                  <Text className="font-semibold text-green-800">
                    Todo listo. Ya puedes guardar el trámite.
                  </Text>
                </View>
              )}
              <View className="flex-row justify-end gap-3">
                <Button
                  variant="outline"
                  onPress={() => setServiceModal(false)}
                >
                  <Text>Cancelar</Text>
                </Button>
                <Button
                  disabled={save.isPending || serviceValidationErrors.length > 0}
                  onPress={() => save.mutate()}
                >
                  <Text>
                    {save.isPending ? "Guardando..." : "Guardar cambios"}
                  </Text>
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={eventModal}
        transparent
        animationType="fade"
        onRequestClose={() => setEventModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-8">
          <View className="max-h-[94vh] w-full max-w-5xl rounded-2xl bg-background p-7">
            <ScrollView contentContainerStyle={{ gap: 18 }}>
              <View>
                <Text className="text-2xl font-bold">
                  {eventForm.id ? "Editar evento" : "Crear evento de atención"}
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Selecciona un punto en el mapa para guardar la ubicación
                  exacta.
                </Text>
              </View>
              <Field
                label="Nombre del evento"
                value={eventForm.name}
                onChangeText={(name) => setEventForm({ ...eventForm, name })}
                placeholder="Ej. Jornada de Atención Huimanguillo"
              />
              <DateTimeField
                label="Fecha y hora de inicio"
                value={eventForm.startsAt}
                onChange={(startsAt) =>
                  setEventForm({
                    ...eventForm,
                    startsAt,
                    endsAt: eventForm.endsAt || startsAt,
                  })
                }
              />
              <DateTimeField
                label="Fecha y hora de término"
                value={eventForm.endsAt}
                onChange={(endsAt) => setEventForm({ ...eventForm, endsAt })}
              />
              <Field
                label="Notas del evento"
                value={eventForm.notes || ""}
                onChangeText={(notes) => setEventForm({ ...eventForm, notes })}
                placeholder="Información adicional para el personal capturista"
              />
              <View className="grid grid-cols-[1fr_280px] gap-5">
                <Suspense
                  fallback={
                    <View
                      style={{
                        height: 360,
                        backgroundColor: "#f4f4f5",
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text>Cargando mapa...</Text>
                    </View>
                  }
                >
                  {eventModal && (
                    <LocationPicker
                      latitude={eventForm.latitude}
                      longitude={eventForm.longitude}
                      locality={eventForm.locality}
                      onChange={(latitude, longitude) =>
                        setEventForm({ ...eventForm, latitude, longitude })
                      }
                      onPlaceSelected={(
                        locality,
                        address,
                        latitude,
                        longitude,
                        detectedMunicipality,
                      ) => {
                        const municipality = resolveTabascoMunicipality(
                          detectedMunicipality || address,
                        );
                        const municipalityCode =
                          municipalityFolioCode(municipality);
                        setEventForm({
                          ...eventForm,
                          locality,
                          address,
                          latitude,
                          longitude,
                          municipality,
                          municipalityCode,
                          folioPrefix:
                            municipalityCode === eventForm.municipalityCode
                              ? eventForm.folioPrefix
                              : municipalityCode,
                        });
                      }}
                    />
                  )}
                </Suspense>
                <View className="gap-4 rounded-xl border border-border p-4">
                  <Text className="font-bold">Ubicación seleccionada</Text>
                  <View>
                    <Text className="text-xs text-muted-foreground">
                      Dirección
                    </Text>
                    <Text className="font-semibold">
                      {eventForm.address ||
                        "Busca una ubicación o selecciona un punto en el mapa"}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-muted-foreground">
                      Localidad / municipio
                    </Text>
                    <Text className="font-semibold">
                      {eventForm.locality || "—"} /{" "}
                      {eventForm.municipality || "—"}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    Coordenadas: {eventForm.latitude.toFixed(6)},{" "}
                    {eventForm.longitude.toFixed(6)}
                  </Text>
                  <View className="rounded-lg bg-primary/10 p-3">
                    <Text className="text-xs font-semibold text-primary">
                      Folio automático
                    </Text>
                    <Text className="text-lg font-bold text-primary">
                      {/-\d+$/.test(eventForm.folioPrefix)
                        ? eventForm.folioPrefix
                        : `${eventForm.municipalityCode || "MUNICIPIO"}-##`}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="flex-row items-center justify-between rounded-xl bg-muted p-4">
                <View>
                  <Text className="font-semibold">Evento activo</Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    Permite registrar solicitudes durante esta jornada.
                  </Text>
                </View>
                <Switch
                  value={eventForm.active}
                  onValueChange={(active) =>
                    setEventForm({ ...eventForm, active })
                  }
                />
              </View>
              <View className="flex-row justify-end gap-3">
                <Button variant="outline" onPress={() => setEventModal(false)}>
                  <Text>Cancelar</Text>
                </Button>
                <Button
                  disabled={
                    saveEvent.isPending ||
                    !eventForm.name ||
                    !eventForm.locality ||
                    !eventForm.municipality ||
                    !eventForm.address ||
                    !eventForm.startsAt ||
                    !eventForm.endsAt ||
                    new Date(eventForm.endsAt).getTime() <= new Date(eventForm.startsAt).getTime()
                  }
                  onPress={() => saveEvent.mutate()}
                >
                  <Text>
                    {saveEvent.isPending ? "Guardando..." : "Guardar evento"}
                  </Text>
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={userModal}
        transparent
        animationType="fade"
        onRequestClose={() => setUserModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-8">
          <View className="w-full max-w-xl rounded-2xl bg-background p-7">
            <View className="gap-5">
              <Text className="text-2xl font-bold">
                {invite.id ? "Editar usuario institucional" : "Nuevo usuario institucional"}
              </Text>
              <View className="gap-2">
                <Text className="text-sm font-semibold">Rol</Text>
                <View className="flex-row gap-2">
                  {(["capturista", "gestor", "enlace", "secretaria"] as const).map((role) => (
                    <Pressable
                      key={role}
                      onPress={() => setInvite({ ...invite, role })}
                      className={`flex-1 rounded-xl border p-3 ${invite.role === role ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      <Text className="text-center capitalize">{role}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="text-xs text-muted-foreground">
                  Capturista genera solicitudes; gestor y enlace atienden su unidad;
                  Secretaría consulta el reporte general de solo lectura.
                </Text>
              </View>
              <Field
                label="Nombre completo"
                value={invite.name}
                onChangeText={(name) => setInvite({ ...invite, name })}
              />
              <Field
                label="Correo @tabasco.gob.mx"
                value={invite.email}
                onChangeText={(email) =>
                  setInvite({ ...invite, email: email.toLowerCase() })
                }
              />
              {!invite.id ? (
                <Field
                  label="Contraseña temporal"
                  value={invite.password}
                  onChangeText={(password) => setInvite({ ...invite, password })}
                  secureTextEntry
                />
              ) : null}
              {invite.role !== "secretaria" ? (
                <UnitPicker
                  units={units.data || []}
                  value={invite.unitId}
                  onChange={(unitId) => setInvite({ ...invite, unitId })}
                />
              ) : null}
              {invite.id ? (
                <View className="flex-row items-center justify-between rounded-xl bg-muted p-4">
                  <View><Text className="font-semibold">Usuario activo</Text><Text className="text-xs text-muted-foreground">Al desactivarlo ya no podrá operar en el sistema.</Text></View>
                  <Switch value={invite.active} onValueChange={(active) => setInvite({ ...invite, active })} />
                </View>
              ) : null}
              <View className="flex-row justify-end gap-3">
                <Button variant="outline" onPress={() => setUserModal(false)}>
                  <Text>Cancelar</Text>
                </Button>
                <Button
                  disabled={
                    createUser.isPending ||
                    !invite.name ||
                    !invite.email.endsWith("@tabasco.gob.mx") ||
                    (!invite.id && invite.password.length < 8) ||
                    (invite.role !== "secretaria" && !invite.unitId)
                  }
                  onPress={() => createUser.mutate()}
                >
                  <Text>
                    {createUser.isPending ? "Guardando..." : invite.id ? "Guardar cambios" : "Crear usuario"}
                  </Text>
                </Button>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function WebAdminDashboard() {
  const { user } = useAuth();
  if (user?.role === "secretaria") return <SecretaryDashboard />;
  if (user?.role === "gestor") return <GestorDashboard />;
  if (user?.role === "enlace") return <EnlaceDashboard />;
  if (user?.role !== "super_admin") return <Redirect href="/home" />;
  return <SuperAdminDashboard />;
}
