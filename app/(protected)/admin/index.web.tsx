"use client";

import { AdminDataTable } from "@/src/components/modules/admin/AdminDataTable.web";
import {
  RequestsBarChart,
  StatusPieChart,
  type DashboardChartDatum,
} from "@/src/components/modules/admin/DashboardCharts.web";
import {
  FormFieldBuilder,
  isFormBuilderValid,
} from "@/src/components/modules/admin/FormFieldBuilder.web";
import { RequirementBuilder } from "@/src/components/modules/admin/RequirementBuilder.web";
import { TargetAudienceBuilder } from "@/src/components/modules/admin/TargetAudienceBuilder.web";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import {
  adminService,
  AttentionEventInput,
  ServiceInput,
  type ServiceRequirementInput,
} from "@/src/services/admin";
import { filesService } from "@/src/services/files";
import { identityApi } from "@/src/services/identityApi";
import { requestsService } from "@/src/services/requests";
import type {
  AdministrativeUnit,
  AttentionEvent,
  ProcedureService,
  ServiceFormField,
  ServiceType,
} from "@/src/types/catalog";
import Monicon from "@monicon/native";
import React, { Suspense } from "react";
import { createPortal } from "react-dom";

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
const MunicipalEventsMap = React.lazy(() =>
  import("@/src/components/modules/admin/MunicipalEventsMap.web").then((m) => ({
    default: m.MunicipalEventsMap,
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
  Image,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";

const DEFAULT_SERVICE_IMAGE = require("@/src/assets/images/logo-turismo.png");

type Section =
  | "resumen"
  | "reportes"
  | "formulario"
  | "eventos"
  | "unidades"
  | "tramites"
  | "usuarios"
  | "solicitudes"
  | "correos";
type SecretarySection = "resumen" | "eventos" | "reporte" | "solicitudes";
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
  { key: "resumen", label: "Resumen", icon: "ci:chart-pie" },
  { key: "reportes", label: "Reporte por evento", icon: "ci:file-document" },
  { key: "formulario", label: "Formulario global", icon: "ci:note-edit" },
  { key: "eventos", label: "Eventos de atención", icon: "ci:calendar-event" },
  { key: "unidades", label: "Unidades", icon: "ci:building-03" },
  { key: "tramites", label: "Trámites y servicios", icon: "ci:list-checklist" },
  { key: "usuarios", label: "Usuarios y enlaces", icon: "ci:users-group" },
  { key: "solicitudes", label: "Solicitudes", icon: "ci:file-document" },
  { key: "correos", label: "Correos enviados", icon: "ci:mail" },
];
const secretaryNav: { key: SecretarySection; label: string; icon: string }[] = [
  { key: "resumen", label: "Dashboard general", icon: "ci:chart-pie" },
  { key: "eventos", label: "Eventos y mapa", icon: "ci:map" },
  { key: "reporte", label: "Reporte por evento", icon: "ci:file-document" },
  { key: "solicitudes", label: "Solicitudes", icon: "ci:list-checklist" },
];

const ROLE_DETAILS = {
  capturista: {
    title: "Capturista",
    description: "Pertenece a una unidad administrativa para identificar su área. Registra solicitudes y consulta únicamente las que ha capturado, sin permisos de gestión.",
  },
  capturista_secretaria: {
    title: "Representante de la Titular",
    description: "Registra solicitudes en representación de Secretaría. Todas sus capturas se envían automáticamente como prioritarias y no está ligado a una unidad administrativa.",
  },
  gestor: {
    title: "Gestor",
    description: "Atiende las solicitudes asignadas a su unidad, actualiza su estatus y registra comentarios y resultados.",
  },
  enlace: {
    title: "Enlace de canalización",
    description: "Analiza las solicitudes que una unidad marcó como «no corresponde» y las redirige a la unidad administrativa correcta, conservando el historial del movimiento.",
  },
  secretaria: {
    title: "Secretaria",
    description: "Consulta la información general, reportes, mapas, solicitudes e historial de los eventos, sin modificar la operación.",
  },
  super_admin: {
    title: "Superadministrador",
    description: "Administra eventos, unidades, trámites, formularios, usuarios, roles y la configuración general del sistema.",
  },
} as const;

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
  value: number | string;
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

function EventMultiSelect({
  events,
  value,
  onChange,
  disabled,
}: {
  events: AttentionEvent[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 320 });
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const selectedNames = events.filter((event) => value.includes(event.id)).map((event) => event.name);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  const toggleMenu = () => {
    if (!open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen((current) => !current);
  };

  return (
    <div ref={anchorRef} className="relative min-w-0 basis-80 flex-1">
      <Text className="text-sm font-semibold">Eventos</Text>
      <Pressable
        disabled={disabled}
        onPress={toggleMenu}
        className={`mt-2 min-h-11 flex-row items-center justify-between rounded-lg border border-zinc-300 bg-background px-3 py-2 ${disabled ? "cursor-not-allowed opacity-40" : "hover:border-primary"}`}
      >
        <Text className={`flex-1 ${value.length ? "font-medium" : "text-muted-foreground"}`} numberOfLines={1}>
          {!value.length ? "Seleccionar eventos" : value.length === 1 ? selectedNames[0] : `${value.length} eventos seleccionados`}
        </Text>
        <Text className="ml-3 text-muted-foreground">{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && !disabled && typeof document !== "undefined" ? createPortal(
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl" style={{ position: "fixed", top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, zIndex: 2147483647 }}>
          <View className="mb-2 flex-row items-center justify-between border-b border-border px-2 pb-2">
            <Text className="text-xs font-semibold text-muted-foreground">{value.length} seleccionados</Text>
            {value.length ? <Pressable onPress={() => onChange([])}><Text className="text-xs font-semibold text-primary">Limpiar</Text></Pressable> : null}
          </View>
          {(events || []).map((event) => {
            const checked = value.includes(event.id);
            return (
              <Pressable key={event.id} onPress={() => toggle(event.id)} className={`mb-1 flex-row items-center gap-3 rounded-lg p-3 ${checked ? "bg-primary/10" : "hover:bg-muted"}`}>
                <View className={`h-5 w-5 items-center justify-center rounded border ${checked ? "border-primary bg-primary" : "border-zinc-300"}`}><Text className="text-xs font-bold text-white">{checked ? "✓" : ""}</Text></View>
                <View className="flex-1"><Text className="font-medium">{event.name}</Text><Text className="text-xs text-muted-foreground">{event.locality}, {event.municipality}</Text></View>
              </Pressable>
            );
          })}
          {!events.length ? <Text className="p-3 text-center text-muted-foreground">No hay eventos disponibles.</Text> : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function OperationalSidebar({
  active,
  title,
  onSectionChange,
}: {
  active: "bandeja" | "canalizacion" | "reportes";
  title: string;
  onSectionChange?: (section: "canalizacion" | "reportes") => void;
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
    `w-full flex-row items-center gap-3 rounded-xl px-4 py-3 ${selected ? "bg-primary" : "hover:bg-muted"}`;
  const canalizationNav = [
    { key: "canalizacion" as const, label: "Mesa de canalización", icon: "ci:list-checklist" },
    { key: "reportes" as const, label: "Reportes", icon: "ci:chart-pie" },
  ];
  return (
    <View className="w-72 border-r border-border bg-card p-5">
      <View className="mb-8 border-b border-border pb-5">
        <Text className="text-xl font-bold text-primary">Jornadas</Text>
        <Text className="mt-1 text-xs text-muted-foreground">{title}</Text>
      </View>
      <View className="gap-2">
        <Pressable onPress={() => router.push("/secretary-requests" as any)} className="mb-2 flex-row items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 hover:bg-amber-100">
          <Monicon name="ci:file-document" size={20} color="#92400e" />
          <View className="flex-1"><Text className="font-semibold text-amber-950">Atención de Secretaria</Text><Text className="mt-1 text-xs text-amber-800">Oficios prioritarios</Text></View>
        </Pressable>
        {active === "bandeja" ? (
          <>
            <Pressable className={itemClass(true)}>
              <Monicon name="ci:list-checklist" size={20} color="#ffffff" />
              <Text className="font-semibold text-primary-foreground">Bandeja de solicitudes</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/home" as any)} className="mt-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              <Text className="font-semibold text-primary">＋ Nueva captura</Text>
              <Text className="mt-1 text-xs text-muted-foreground">Registrar solicitud asistida</Text>
            </Pressable>
          </>
        ) : (
          canalizationNav.map((item) => (
            <Pressable key={item.key} onPress={() => onSectionChange?.(item.key)} className={itemClass(active === item.key)}>
              <Monicon name={item.icon} size={20} color={active === item.key ? "#ffffff" : "#71717a"} />
              <Text className={`font-medium ${active === item.key ? "text-primary-foreground" : ""}`}>{item.label}</Text>
            </Pressable>
          ))
        )}
      </View>
      <View className="mt-auto border-t border-border pt-5">
        <View className="mb-4 flex-row items-center gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-semibold" numberOfLines={1}>{user?.nombre}</Text>
            <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
              {active === "canalizacion" || active === "reportes" ? "Rol: Enlace de canalización" : `Rol: Gestor · ${units.isLoading ? "Cargando..." : assignedUnit?.name || "Sin unidad asignada"}`}
            </Text>
          </View>
          <SidebarThemeButton />
        </View>
        <Button variant="outline" onPress={logout}><Text>Cerrar sesión</Text></Button>
      </View>
    </View>
  );
}

function AdminRefreshButton({ queryKey }: { queryKey: string }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: [queryKey], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["sidebar"], type: "active" }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <Button variant="outline" disabled={refreshing} onPress={refresh}>
      {refreshing ? <ActivityIndicator size="small" color="#981646" /> : <Monicon name="ci:refresh" size={18} color="#981646" />}
      <Text>{refreshing ? "Actualizando..." : "Actualizar datos"}</Text>
    </Button>
  );
}

function SidebarThemeButton() {
  const { colorScheme, toggleTheme } = useTheme();
  const isDark = colorScheme === "dark";
  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <div className="w-fit" title={label}>
      <Button
        variant="outline"
        size="icon"
        className="rounded-full"
        accessibilityLabel={label}
        onPress={() => void toggleTheme()}
      >
        <Monicon
          name={isDark ? "ic:outline-light-mode" : "ic:outline-dark-mode"}
          size={19}
          color={isDark ? "#f4f4f5" : "#27272a"}
        />
      </Button>
    </div>
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
  if (typeof value !== "string") {
    if (value && typeof value === "object") {
      try { return JSON.stringify(value); } catch { return "Información no disponible"; }
    }
    return String(value ?? "—");
  }
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
  const [exhibitionSearch, setExhibitionSearch] = useState("");
  const [exhibitionEventId, setExhibitionEventId] = useState("");
  const [reassignmentReasons, setReassignmentReasons] = useState<Record<string, string>>({});
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const requests = useQuery({
    queryKey: ["gestor", "requests", user?.unidadAdministrativaId],
    queryFn: () => requestsService.listByUnit(user!.unidadAdministrativaId!),
    enabled: Boolean(user?.unidadAdministrativaId),
    refetchOnWindowFocus: true,
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
          <AdminRefreshButton queryKey="gestor" />
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
          <AdminDataTable
            data={requests.data || []}
            getRowId={(request) => request.id}
            searchPlaceholder="Buscar por folio, trámite, evento o capturista..."
            filterLabel="Todos los estatus"
            filterOptions={["enviada", ...REQUEST_STATUSES].map((status) => ({
              label: REQUEST_STATUS_LABELS[status] || status,
              value: status,
            }))}
            getFilterValue={(request) => request.status}
            emptyMessage="No hay solicitudes asignadas a tu unidad."
            columns={[
              {
                key: "folio",
                title: "FOLIO",
                value: (request) => request.folio,
                width: 180,
                render: (request) => <View><Text className="font-semibold">{request.folio}</Text><Text className="text-xs text-muted-foreground">{new Date(request.requestedAt).toLocaleDateString("es-MX")}</Text>{request.priorityOnReopening ? <Text className="mt-1 text-xs font-bold text-amber-700">PRIORITARIA</Text> : null}</View>,
              },
              { key: "service", title: "TRÁMITE", value: (request) => serviceNames[request.serviceId] || "Trámite no disponible", width: 260 },
              { key: "event", title: "EVENTO", value: (request) => request.eventId ? eventNames[request.eventId] || request.eventFolio || "Evento" : "Fuera de evento", width: 220 },
              { key: "staff", title: "CAPTURISTA", value: (request) => staffNames[request.applicantUserId] || "No identificado", width: 190 },
              { key: "status", title: "ESTATUS", value: (request) => REQUEST_STATUS_LABELS[request.status] || request.status, width: 150, render: (request) => <Text className="font-semibold text-primary">{REQUEST_STATUS_LABELS[request.status] || request.status}</Text> },
            ]}
            renderActions={(request) => (
              <Button size="sm" variant="outline" onPress={() => router.push(`/admin/solicitud/${request.id}` as any)}>
                <Text>Ver detalles</Text>
              </Button>
            )}
          />
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
                      <Text className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Prioritaria</Text>
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
        </ScrollView>
      </View>
    </View>
  );
}

function EnlaceDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<"canalizacion" | "reportes">("canalizacion");
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const queue = useQuery({
    queryKey: ["enlace", "reassignment-queue"],
    queryFn: identityApi.listReassignmentQueue,
  });
  const secretaryQueue = useQuery({
    queryKey: ["enlace", "secretary-requests"],
    queryFn: identityApi.listSecretaryRequests,
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
  });
  const report = useQuery({
    queryKey: ["enlace", "canalization-report"],
    queryFn: identityApi.getCanalizationReport,
  });
  const units = useQuery({ queryKey: ["enlace", "units"], queryFn: adminService.listUnits });
  const services = useQuery({ queryKey: ["enlace", "services"], queryFn: adminService.listServices });
  const events = useQuery({ queryKey: ["enlace", "events"], queryFn: adminService.listEvents });
  const globalForm = useQuery({ queryKey: ["enlace", "global-form"], queryFn: adminService.getGlobalForm });
  const unitNames = useMemo(() => Object.fromEntries((units.data || []).map((unit) => [unit.id, unit.name])), [units.data]);
  const serviceNames = useMemo(() => Object.fromEntries((services.data || []).map((service) => [service.id, service.name])), [services.data]);
  const eventsById = useMemo(
    () => Object.fromEntries((events.data || []).map((event) => [event.id, event])),
    [events.data],
  );
  const applicantFieldLabels = useMemo(
    () => Object.fromEntries((globalForm.data?.fields || []).map((field) => [field.key, field.label])),
    [globalForm.data?.fields],
  );
  const requestFieldLabels = useMemo(
    () => Object.fromEntries((services.data || []).map((service) => [
      service.id,
      Object.fromEntries((service.formConfig?.fields || []).map((field) => [field.key, field.label])),
    ])),
    [services.data],
  );
  const canalizationRows = useMemo(() => [
    ...(secretaryQueue.data?.requests || [])
      .filter((request) => request.status === "pendiente_canalizacion")
      .map((request) => ({
        id: request.id,
        source: "secretaria" as const,
        folio: request.folio,
        eventFolio: request.eventFolio || "—",
        eventName: request.eventId ? eventsById[request.eventId]?.name || "Evento no disponible" : "Sin evento",
        date: request.createdAt,
        requestType: "Solicitud de Secretaría",
        service: request.subject || "Atención prioritaria",
      })),
    ...(queue.data?.requests || []).map((request) => ({
      id: request.id,
      source: "regular" as const,
      folio: request.folio,
      eventFolio: request.eventFolio || "—",
      eventName: request.eventId ? eventsById[request.eventId]?.name || "Evento no disponible" : "Sin evento",
      date: request.requestedAt,
      requestType: "Trámite o servicio",
      service: serviceNames[request.serviceId] || "Trámite no disponible",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [eventsById, queue.data?.requests, secretaryQueue.data?.requests, serviceNames]);
  const reportItems = report.data?.items || [];
  const pendingCount = reportItems.filter((item) => item.pending).length;
  const resolvedItems = reportItems.filter((item) => !item.pending);
  const averageHours = resolvedItems.length
    ? resolvedItems.reduce((total, item) => total + Math.max(0, new Date(item.resolvedAt || item.requestedAt).getTime() - new Date(item.requestedAt).getTime()), 0) / resolvedItems.length / 3_600_000
    : 0;
  const originChart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of report.data?.items || []) {
      const id = item.previousUnitId || "sin-unidad";
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return [...counts.entries()].map(([id, value]) => ({ label: unitNames[id] || "Sin unidad", value })).sort((a, b) => b.value - a.value);
  }, [report.data?.items, unitNames]);
  const destinationChart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of report.data?.items || []) {
      if (!item.destinationUnitId) continue;
      counts.set(item.destinationUnitId, (counts.get(item.destinationUnitId) || 0) + 1);
    }
    return [...counts.entries()].map(([id, value]) => ({ label: unitNames[id] || "Unidad no disponible", value })).sort((a, b) => b.value - a.value);
  }, [report.data?.items, unitNames]);
  const reassign = useMutation({
    mutationFn: ({ requestId, unitId }: { requestId: string; unitId: string }) =>
      identityApi.reassignRequest(requestId, unitId, comments[requestId]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enlace", "reassignment-queue"] });
      await queryClient.invalidateQueries({ queryKey: ["enlace", "canalization-report"] });
      setNotice("Solicitud canalizada correctamente a la unidad responsable.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });
  const canalizeSecretaryRequest = useMutation({
    mutationFn: ({ requestId, unitId }: { requestId: string; unitId: string }) =>
      identityApi.updateSecretaryRequest(requestId, { unitId, comment: comments[requestId] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enlace", "secretary-requests"] });
      setNotice("Solicitud de Secretaría canalizada correctamente a la unidad responsable.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });

  return (
    <View className="h-screen flex-row bg-muted/30">
      <OperationalSidebar active={section} title="Enlace de canalización" onSectionChange={setSection} />
      <View className="flex-1 overflow-hidden">
        <View className="flex-row items-center justify-between border-b border-border bg-card px-8 py-5">
          <View>
            <Text className="text-2xl font-bold">{section === "canalizacion" ? "Mesa de canalización" : "Reportes de canalización"}</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              {user?.nombre} · {section === "canalizacion" ? "Revisión de solicitudes que no aplican en su unidad original" : "Resultados globales de la canalización entre unidades"}
            </Text>
          </View>
          <AdminRefreshButton queryKey="enlace" />
        </View>
        <ScrollView contentContainerStyle={{ padding: 32, gap: 16 }}>
          {section === "canalizacion" ? (
            <>
              <View className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <Text className="text-lg font-bold">Función del Enlace de canalización</Text>
                <Text className="mt-1 text-muted-foreground">Lee el motivo y los datos del expediente, identifica la unidad competente y canaliza la solicitud. El movimiento queda registrado en el historial.</Text>
              </View>
              {notice ? <Text className="rounded-xl bg-primary/10 p-3 text-primary">{notice}</Text> : null}
              {secretaryQueue.error ? <Text className="rounded-xl bg-destructive/10 p-3 text-destructive">No fue posible cargar las solicitudes de Secretaría: {secretaryQueue.error.message}</Text> : null}
              {queue.isLoading || secretaryQueue.isLoading || units.isLoading || services.isLoading || events.isLoading || globalForm.isLoading ? <ActivityIndicator color="#981646" /> : null}
              <AdminDataTable
                data={canalizationRows}
                getRowId={(item) => `${item.source}-${item.id}`}
                searchPlaceholder="Buscar por folio, evento o trámite..."
                filterLabel="Todos los tipos"
                filterOptions={[{ label: "Solicitudes de Secretaría", value: "secretaria" }, { label: "Trámites y servicios", value: "regular" }]}
                getFilterValue={(item) => item.source}
                emptyMessage="No hay solicitudes pendientes de canalización."
                columns={[
                  { key: "folio", title: "FOLIO", value: (item) => item.folio, width: 145, render: (item) => <Text className="font-semibold text-primary">{item.folio}</Text> },
                  { key: "eventFolio", title: "FOLIO EVENTO", value: (item) => item.eventFolio, width: 145 },
                  { key: "event", title: "EVENTO", value: (item) => item.eventName, width: 210 },
                  { key: "date", title: "FECHA", value: (item) => new Date(item.date).getTime(), width: 135, render: (item) => <Text>{new Date(item.date).toLocaleDateString("es-MX")}</Text> },
                  { key: "type", title: "TIPO", value: (item) => item.requestType, width: 190 },
                  { key: "service", title: "TRÁMITE / SERVICIO", value: (item) => item.service, width: 260 },
                ]}
                renderActions={(item) => (
                  <Button size="sm" variant="outline" onPress={() => router.push((item.source === "secretaria" ? `/admin/solicitud-secretaria/${item.id}` : `/admin/solicitud/${item.id}`) as any)}>
                    <Text>Ver detalle</Text>
                  </Button>
                )}
              />
              {false && (secretaryQueue.data?.requests || []).filter((request) => request.status === "pendiente_canalizacion").map((request) => (
                <View key={request.id} className="gap-4 rounded-2xl border border-primary/30 bg-card p-5">
                  <View className="flex-row justify-between gap-4">
                    <View className="flex-1">
                      <Text className="text-xs font-bold uppercase tracking-wider text-primary">Solicitud enviada por Secretaría</Text>
                      <Text className="mt-1 text-lg font-bold">{request.folio}</Text>
                      <Text className="mt-1 font-semibold">{request.subject}</Text>
                      <Text className="mt-1 text-sm text-muted-foreground">Capturó: {request.capturedByName}</Text>
                    </View>
                    <Text className="font-semibold text-amber-700">Pendiente de canalización</Text>
                  </View>
                  {request.notes ? <View className="rounded-xl bg-amber-50 p-4"><Text className="text-xs font-bold text-amber-900">OBSERVACIONES</Text><Text className="mt-1 text-amber-900">{request.notes}</Text></View> : null}
                  <View className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
                    <View className="rounded-xl border border-border p-4">
                      <Text className="mb-3 font-bold">Datos de la persona solicitante</Text>
                      {Object.entries(request.applicantData || {}).map(([key, value]) => (
                        <Text key={key} className="mb-1 text-sm"><Text className="font-semibold">{applicantFieldLabels[key] || key.replace(/^pregunta_?/, "Pregunta ").replaceAll("_", " ")}:</Text> {formatRequestValue(value)}</Text>
                      ))}
                    </View>
                    <View className="gap-3 rounded-xl border border-border p-4">
                      <Text className="font-bold">Canalizar a</Text>
                      <select
                        value={destinations[request.id] || ""}
                        onChange={(event) => setDestinations((current) => ({ ...current, [request.id]: event.currentTarget.value }))}
                        className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"
                      >
                        <option value="">Selecciona la unidad responsable</option>
                        {(units.data || []).filter((unit) => unit.active).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                      </select>
                      <Field label="Criterio de canalización" value={comments[request.id] || ""} onChangeText={(comment) => setComments((current) => ({ ...current, [request.id]: comment }))} placeholder="Motivo para asignarla a esta unidad" />
                      <View className="items-end">
                        <Button disabled={!destinations[request.id] || canalizeSecretaryRequest.isPending} onPress={() => canalizeSecretaryRequest.mutate({ requestId: request.id, unitId: destinations[request.id] })}>
                          <Text>{canalizeSecretaryRequest.isPending ? "Canalizando..." : "Confirmar canalización"}</Text>
                        </Button>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
              {false && (queue.data?.requests || []).map((request) => (
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
                  <View className="flex-row justify-end">
                    <Button variant="outline" onPress={() => router.push(`/admin/solicitud/${request.id}` as any)}>
                      <Text>Ver expediente completo</Text>
                    </Button>
                  </View>
                  <View className="rounded-xl border border-border bg-muted/30 p-4">
                    <Text className="text-xs font-bold text-muted-foreground">EVENTO DE ORIGEN</Text>
                    {request.eventId && eventsById[request.eventId] ? (
                      <View className="mt-2 gap-1">
                        <Text className="font-semibold">{eventsById[request.eventId].name}</Text>
                        <Text className="text-sm">Folio del evento: {request.eventFolio || eventsById[request.eventId].folioPrefix || "No disponible"}</Text>
                        <Text className="text-sm text-muted-foreground">
                          {eventsById[request.eventId].venue} · {eventsById[request.eventId].locality}, {eventsById[request.eventId].municipality}
                        </Text>
                        <Text className="text-sm text-muted-foreground">{eventsById[request.eventId].address}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {new Date(eventsById[request.eventId].startsAt).toLocaleString("es-MX")} – {new Date(eventsById[request.eventId].endsAt).toLocaleString("es-MX")}
                        </Text>
                      </View>
                    ) : (
                      <Text className="mt-2 text-sm text-muted-foreground">
                        {request.eventFolio ? `Evento con folio ${request.eventFolio}` : "Sin evento relacionado"}
                      </Text>
                    )}
                  </View>
                  <View className="grid grid-cols-2 gap-4">
                    <View className="rounded-xl border border-border p-4">
                      <Text className="mb-3 font-bold">Datos de la persona solicitante</Text>
                      {Object.entries(request.applicantData || {}).filter(([key]) => !/^_*seguimiento$/i.test(key)).map(([key, value]) => (
                        <Text key={key} className="mb-1 text-sm"><Text className="font-semibold">{applicantFieldLabels[key] || key.replace(/^pregunta_?/, "Pregunta ").replaceAll("_", " ")}:</Text> {formatRequestValue(value)}</Text>
                      ))}
                    </View>
                    <View className="rounded-xl border border-border p-4">
                      <Text className="mb-3 font-bold">Datos del trámite solicitado</Text>
                      {Object.entries(request.requestData || {}).filter(([key]) => !/^_*seguimiento$/i.test(key)).map(([key, value]) => (
                        <Text key={key} className="mb-1 text-sm"><Text className="font-semibold">{requestFieldLabels[request.serviceId]?.[key] || key.replace(/^pregunta_?/, "Pregunta ").replaceAll("_", " ")}:</Text> {formatRequestValue(value)}</Text>
                      ))}
                    </View>
                  </View>
                  <View className="gap-2">
                    <Text className="text-sm font-semibold">Canalizar a</Text>
                    <select
                      value={destinations[request.id] || ""}
                      onChange={(event) => {
                        const unitId = event.currentTarget.value;
                        setDestinations((current) => ({ ...current, [request.id]: unitId }));
                      }}
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
              <View className="mt-4 gap-4 border-t border-border pt-6">
                <View>
                  <Text className="text-xl font-bold">Solicitudes canalizadas</Text>
                  <Text className="mt-1 text-sm text-muted-foreground">
                    Historial de solicitudes que ya fueron enviadas a la unidad administrativa correspondiente.
                  </Text>
                </View>
                <AdminDataTable
                  data={resolvedItems}
                  getRowId={(item) => item.id}
                  searchPlaceholder="Buscar por folio, trámite, unidad o motivo..."
                  emptyMessage="Todavía no se han canalizado solicitudes."
                  columns={[
                    { key: "folio", title: "FOLIO", value: (item) => item.folio },
                    { key: "service", title: "TRÁMITE", value: (item) => serviceNames[item.serviceId] || item.serviceId, width: 220 },
                    { key: "origin", title: "UNIDAD DE ORIGEN", value: (item) => unitNames[item.previousUnitId || ""] || "No disponible", width: 220 },
                    { key: "destination", title: "UNIDAD DE DESTINO", value: (item) => unitNames[item.destinationUnitId || ""] || "No disponible", width: 220 },
                    { key: "reason", title: "MOTIVO", value: (item) => item.reason || "Sin motivo", width: 240 },
                    { key: "date", title: "CANALIZADA", value: (item) => new Date(item.resolvedAt || item.requestedAt).getTime(), width: 160, render: (item) => <Text>{new Date(item.resolvedAt || item.requestedAt).toLocaleDateString("es-MX")}</Text> },
                  ]}
                  renderActions={(item) => (
                    <Button size="sm" variant="outline" onPress={() => router.push(`/admin/solicitud/${item.id}` as any)}>
                      <Text>Ver detalles</Text>
                    </Button>
                  )}
                />
              </View>
            </>
          ) : (
            <View className="gap-5">
              {report.isLoading || units.isLoading || services.isLoading ? <ActivityIndicator color="#981646" /> : null}
              <View className="grid grid-cols-4 gap-4">
                {[
                  { label: "Recibidas para revisión", value: reportItems.length, note: "Total de solicitudes canalizadas o pendientes" },
                  { label: "Pendientes", value: pendingCount, note: "Esperan análisis del enlace" },
                  { label: "Canalizadas", value: resolvedItems.length, note: "Enviadas a otra unidad" },
                  { label: "Tiempo promedio", value: `${averageHours.toFixed(1)} h`, note: "Desde la solicitud hasta su canalización" },
                ].map((metric) => (
                  <View key={metric.label} className="rounded-2xl border border-border bg-card p-5">
                    <Text className="text-sm text-muted-foreground">{metric.label}</Text>
                    <Text className="mt-2 text-3xl font-bold">{metric.value}</Text>
                    <Text className="mt-2 text-xs text-muted-foreground">{metric.note}</Text>
                  </View>
                ))}
              </View>
              <View className="grid grid-cols-2 gap-5">
                <View className="rounded-2xl border border-border bg-card p-5">
                  <Text className="text-lg font-bold">Unidades de origen</Text>
                  <Text className="mt-1 text-sm text-muted-foreground">Unidades que marcaron solicitudes como no correspondientes.</Text>
                  <RequestsBarChart data={originChart.slice(0, 8)} />
                </View>
                <View className="rounded-2xl border border-border bg-card p-5">
                  <Text className="text-lg font-bold">Unidades de destino</Text>
                  <Text className="mt-1 text-sm text-muted-foreground">Unidades que recibieron solicitudes después del análisis.</Text>
                  <RequestsBarChart data={destinationChart.slice(0, 8)} />
                </View>
              </View>
              <AdminDataTable
                data={reportItems}
                getRowId={(item) => item.id}
                searchPlaceholder="Buscar folio, motivo, unidad o trámite..."
                filterLabel="Todos los resultados"
                filterOptions={[{ label: "Pendientes", value: "pending" }, { label: "Canalizadas", value: "resolved" }]}
                getFilterValue={(item) => item.pending ? "pending" : "resolved"}
                emptyMessage="Todavía no hay solicitudes enviadas a canalización."
                columns={[
                  { key: "folio", title: "FOLIO", value: (item) => item.folio },
                  { key: "service", title: "TRÁMITE", value: (item) => serviceNames[item.serviceId] || item.serviceId, width: 220 },
                  { key: "origin", title: "UNIDAD DE ORIGEN", value: (item) => unitNames[item.previousUnitId || ""] || "No disponible", width: 220 },
                  { key: "destination", title: "DESTINO", value: (item) => item.pending ? "Pendiente" : unitNames[item.destinationUnitId || ""] || "No disponible", width: 220 },
                  { key: "reason", title: "MOTIVO", value: (item) => item.reason || "Sin motivo", width: 260 },
                  { key: "date", title: "FECHA", value: (item) => new Date(item.requestedAt).getTime(), width: 150, render: (item) => <Text>{new Date(item.requestedAt).toLocaleDateString("es-MX")}</Text> },
                  { key: "result", title: "RESULTADO", value: (item) => item.pending ? "Pendiente" : "Canalizada", width: 130, render: (item) => <Text className={item.pending ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>{item.pending ? "Pendiente" : "Canalizada"}</Text> },
                ]}
                renderActions={(item) => (
                  <Button size="sm" variant="outline" onPress={() => router.push(`/admin/solicitud/${item.id}` as any)}>
                    <Text>Ver detalles</Text>
                  </Button>
                )}
              />
            </View>
          )}
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
  const [eventFilter, setEventFilter] = useState("");
  const [dashboardEventIds, setDashboardEventIds] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [exhibitionSearch, setExhibitionSearch] = useState("");
  const [exhibitionEventId, setExhibitionEventId] = useState("");
  const requests = useQuery({
    queryKey: ["secretaria", "requests"],
    queryFn: requestsService.listAllAccessible,
    refetchOnWindowFocus: true,
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
      const term = search.trim().toLocaleLowerCase("es-MX");
      return time >= fromTime && time <= toTime
        && (section === "resumen"
          ? (!dashboardEventIds.length || Boolean(request.eventId && dashboardEventIds.includes(request.eventId)))
          : (!eventFilter || request.eventId === eventFilter))
        && (!serviceFilter || request.serviceId === serviceFilter)
        && (!unitFilter || request.unitId === unitFilter)
        && (!staffFilter || request.applicantUserId === staffFilter)
        && (!statusFilter || request.status === statusFilter)
        && (!term || request.folio.toLocaleLowerCase("es-MX").includes(term)
          || Object.values(request.applicantData || {}).some((value) => String(value).toLocaleLowerCase("es-MX").includes(term)));
    }),
    [requests.data, fromTime, toTime, eventFilter, dashboardEventIds, serviceFilter, unitFilter, staffFilter, statusFilter, search, section],
  );
  const filteredEvents = useMemo(
    () => (events.data || []).filter((event) => {
      const startsAt = new Date(event.startsAt).getTime();
      const endsAt = new Date(event.endsAt || event.startsAt).getTime();
      return startsAt <= toTime && endsAt >= fromTime
        && (section === "resumen"
          ? (!dashboardEventIds.length || dashboardEventIds.includes(event.id))
          : (!eventFilter || event.id === eventFilter));
    }),
    [events.data, fromTime, toTime, eventFilter, dashboardEventIds, section],
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
  const unitRanking = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of filteredRequests)
      counts.set(request.unitId, (counts.get(request.unitId) || 0) + 1);
    return (units.data || [])
      .map((unit) => ({ name: unit.name, count: counts.get(unit.id) || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [filteredRequests, units.data]);
  const dailyChart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of [...filteredRequests].reverse()) {
      const label = new Date(request.requestedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()].slice(-14).map(([label, value]) => ({ label, value }));
  }, [filteredRequests]);
  const exhibitionEvents = useMemo(() => {
    const term = exhibitionSearch.trim().toLocaleLowerCase("es-MX");
    return (events.data || []).filter((event) => !term
      || event.name.toLocaleLowerCase("es-MX").includes(term)
      || event.municipality.toLocaleLowerCase("es-MX").includes(term)
      || event.locality.toLocaleLowerCase("es-MX").includes(term)
      || event.folioPrefix.toLocaleLowerCase("es-MX").includes(term));
  }, [events.data, exhibitionSearch]);
  const exhibitionEvent = (events.data || []).find((event) => event.id === exhibitionEventId);
  const exhibitionRequests = useMemo(
    () => (requests.data || []).filter((request) => request.eventId === exhibitionEventId),
    [requests.data, exhibitionEventId],
  );
  const exhibitionStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of exhibitionRequests) counts.set(request.status, (counts.get(request.status) || 0) + 1);
    return [...counts.entries()].map(([status, value]) => ({ label: REQUEST_STATUS_LABELS[status] || status, value })).sort((a, b) => b.value - a.value);
  }, [exhibitionRequests]);
  const exhibitionServices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of exhibitionRequests) counts.set(request.serviceId, (counts.get(request.serviceId) || 0) + 1);
    return [...counts.entries()].map(([id, value]) => ({ label: serviceNames[id] || "Trámite no disponible", value })).sort((a, b) => b.value - a.value);
  }, [exhibitionRequests, serviceNames]);
  const exhibitionUnits = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of exhibitionRequests) counts.set(request.unitId, (counts.get(request.unitId) || 0) + 1);
    return [...counts.entries()].map(([id, value]) => ({ label: unitNames[id] || "Unidad no disponible", value })).sort((a, b) => b.value - a.value);
  }, [exhibitionRequests, unitNames]);
  const exhibitionStaff = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of exhibitionRequests) counts.set(request.applicantUserId, (counts.get(request.applicantUserId) || 0) + 1);
    return [...counts.entries()].map(([id, value]) => ({ id, label: staffNames[id] || "Capturista no identificado", value })).sort((a, b) => b.value - a.value);
  }, [exhibitionRequests, staffNames]);
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
          <Pressable onPress={() => router.push("/secretary-requests" as any)} className="mb-2 flex-row items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 hover:bg-amber-100">
            <Monicon name="ci:file-document" size={20} color="#92400e" />
            <Text className="font-semibold text-amber-950">Atención de Secretaria</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/home" as any)}
            className="mb-2 flex-row items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 hover:bg-primary/10"
          >
            <Monicon name="ci:plus-circle" size={20} color="#981646" />
            <Text className="font-semibold text-primary">Nueva solicitud prioritaria</Text>
          </Pressable>
          {secretaryNav.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => {
                setSection(item.key);
                setFrom(""); setTo(""); setEventFilter(""); setServiceFilter("");
                setDashboardEventIds([]);
                setUnitFilter(""); setStaffFilter(""); setStatusFilter(""); setSearch("");
              }}
              className={`flex-row items-center gap-3 rounded-xl px-4 py-3 ${section === item.key ? "bg-primary" : "hover:bg-muted"}`}
            >
              <Monicon
                name={item.icon}
                size={20}
                color={section === item.key ? "#ffffff" : "#71717a"}
              />
              <Text className={`font-medium ${section === item.key ? "text-primary-foreground" : ""}`}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View className="mt-auto border-t border-border pt-5">
          <View className="mb-4 flex-row items-center gap-3">
            <View className="min-w-0 flex-1">
              <Text className="font-semibold" numberOfLines={1}>{user?.nombre}</Text>
              <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
                Rol: Secretaria · Consulta general
              </Text>
            </View>
            <SidebarThemeButton />
          </View>
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
          <View className="flex-row gap-3">
            <AdminRefreshButton queryKey="secretaria" />
            {section === "solicitudes" ? (
              <Button disabled={!filteredRequests.length} onPress={exportCsv}>
                <Text>Exportar CSV</Text>
              </Button>
            ) : null}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 32, gap: 24 }}>
          {section === "solicitudes" ? <View className="flex-row flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5">
            <View className="min-w-80 gap-2"><Text className="text-sm font-semibold">Evento</Text><select value={eventFilter} onChange={(event) => setEventFilter(event.currentTarget.value)} className="w-full max-w-xl rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Todos los eventos</option>{(events.data || []).map((item) => <option key={item.id} value={item.id}>{item.name} · {new Date(item.startsAt).toLocaleDateString("es-MX")}</option>)}</select></View>
            <View className="min-w-60 flex-1 gap-2"><Text className="text-sm font-semibold">Buscar por folio</Text><Input value={search} onChangeText={setSearch} placeholder="Ej. CENTRO-2026-001" autoCapitalize="characters" /></View>
            <Button variant="outline" disabled={!eventFilter && !search} onPress={() => { setEventFilter(""); setSearch(""); }}><Text>Limpiar filtros</Text></Button>
            <Text className="w-full text-xs font-medium text-muted-foreground">{eventFilter ? `Evento: ${eventNames[eventFilter] || eventFilter}.` : "Todos los eventos."} · {filteredRequests.length} resultados.</Text>
          </View> : null}
          {loading ? <ActivityIndicator color="#981646" /> : null}
          {section === "resumen" ? <>
            <View className="relative z-[1000] overflow-visible rounded-2xl border border-border bg-card p-5">
              <View className="mb-4"><Text className="text-lg font-bold">Filtrar dashboard</Text><Text className="mt-1 text-sm text-muted-foreground">Consulta por rango de fechas o por un evento específico. Los filtros no se pueden combinar.</Text></View>
              <View className="relative z-[1001] flex-row flex-wrap items-end gap-3 overflow-visible">
                <View className="gap-2"><Text className="text-sm font-semibold">Desde</Text><input type="date" value={from} disabled={Boolean(dashboardEventIds.length)} onChange={(event) => { setDashboardEventIds([]); setFrom(event.currentTarget.value); }} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40" /></View>
                <View className="gap-2"><Text className="text-sm font-semibold">Hasta</Text><input type="date" value={to} disabled={Boolean(dashboardEventIds.length)} onChange={(event) => { setDashboardEventIds([]); setTo(event.currentTarget.value); }} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40" /></View>
                <EventMultiSelect events={(events.data || []) as AttentionEvent[]} value={dashboardEventIds} disabled={Boolean(from || to)} onChange={(selected) => { setFrom(""); setTo(""); setDashboardEventIds(selected); }} />
                <Button variant="outline" disabled={!from && !to && !dashboardEventIds.length} onPress={() => { setFrom(""); setTo(""); setDashboardEventIds([]); }}><Text>Restablecer filtros</Text></Button>
              </View>
              <Text className="mt-4 text-xs font-medium text-muted-foreground">{dashboardEventIds.length ? `${dashboardEventIds.length} eventos seleccionados: ${dashboardEventIds.map((id) => eventNames[id] || id).join(", ")}.` : periodDescription} · {filteredRequests.length} solicitudes.</Text>
            </View>
            <View className="flex-row flex-wrap gap-4">
              <Metric label="Solicitudes registradas" value={filteredRequests.length} note={from || to || dashboardEventIds.length ? "Resultado del filtro activo" : "Historial general disponible"} />
              <Metric label="Eventos registrados" value={filteredEvents.length} note={dashboardEventIds.length ? "Eventos seleccionados" : from || to ? "Eventos dentro del periodo" : "Total de jornadas"} />
              <Metric label="Con cambio de estatus" value={changed} note="Solicitudes que ya recibieron atención" />
              <Metric label="Concluidas" value={concluded} note={`${beneficiaries} personas beneficiarias`} />
              <Metric label="Avance de atención" value={`${filteredRequests.length ? Math.round((concluded / filteredRequests.length) * 100) : 0}%`} note="Solicitudes concluidas" />
              <Metric label="No continuaron" value={didNotContinue} note="Rechazadas o canceladas con motivo" />
              <Metric label="Solicitudes prioritarias" value={priority} note="Marcadas para atención prioritaria" />
            </View>
            <View className="grid grid-cols-2 gap-4">
              <View className="rounded-2xl border border-border bg-card p-5">
                <Text className="text-xl font-bold">Solicitudes por estatus</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Distribución durante el periodo seleccionado.
                </Text>
                <StatusPieChart data={statusChart} />
              </View>
              <View className="rounded-2xl border border-border bg-card p-5">
                <Text className="text-xl font-bold">Trámites más solicitados</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Comparativo de los seis trámites con mayor demanda.
                </Text>
                <RequestsBarChart
                  data={ranking.slice(0, 6).map((item) => ({
                    label: item.name,
                    value: item.count,
                  }))}
                />
              </View>
              <View className="col-span-2 rounded-2xl border border-border bg-card p-5">
                <Text className="text-xl font-bold">Solicitudes por evento</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Actividad de las jornadas incluidas en el periodo.
                </Text>
                <RequestsBarChart data={eventChart} />
              </View>
              <View className="rounded-2xl border border-border bg-card p-5">
                <Text className="text-xl font-bold">Solicitudes por unidad</Text>
                <Text className="mt-1 text-sm text-muted-foreground">Carga recibida por unidad administrativa.</Text>
                <RequestsBarChart data={unitRanking.slice(0, 8).map((item) => ({ label: item.name, value: item.count }))} />
              </View>
              <View className="rounded-2xl border border-border bg-card p-5">
                <Text className="text-xl font-bold">Actividad reciente</Text>
                <Text className="mt-1 text-sm text-muted-foreground">Capturas por día en el periodo seleccionado.</Text>
                <RequestsBarChart data={dailyChart} />
              </View>
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
              <View className="min-w-72 flex-1 rounded-2xl border border-border bg-card p-5"><Text className="text-sm text-muted-foreground">Unidad con más solicitudes</Text><Text className="mt-2 text-xl font-bold">{unitRanking[0]?.name || "Sin datos"}</Text><Text className="mt-1 text-primary">{unitRanking[0]?.count || 0} solicitudes</Text></View>
              <View className="min-w-72 flex-1 rounded-2xl border border-border bg-card p-5"><Text className="text-sm text-muted-foreground">Unidad con menos solicitudes</Text><Text className="mt-2 text-xl font-bold">{unitRanking.at(-1)?.name || "Sin datos"}</Text><Text className="mt-1 text-primary">{unitRanking.at(-1)?.count || 0} solicitudes</Text></View>
            </View>
            <View className="rounded-2xl border border-border bg-card p-5">
              <View className="mb-4 flex-row items-end justify-between gap-4">
                <View><Text className="text-xl font-bold">Solicitudes del resultado</Text><Text className="mt-1 text-sm text-muted-foreground">Listado de solicitudes que coinciden con el filtro aplicado al Dashboard.</Text></View>
                <Text className="font-semibold text-primary">{filteredRequests.length} solicitudes</Text>
              </View>
              <div className="max-h-[480px] overflow-auto rounded-xl border border-border">
                <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-zinc-100">
                    <tr>{['Folio', 'Fecha', 'Evento', 'Trámite', 'Unidad', 'Capturista', 'Estatus', 'Acciones'].map((label) => <th key={label} className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-bold uppercase text-zinc-500">{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="border-b border-border last:border-b-0 hover:bg-zinc-50">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-900">{request.folio}</td>
                        <td className="whitespace-nowrap px-4 py-3">{new Date(request.requestedAt).toLocaleDateString("es-MX")}</td>
                        <td className="max-w-56 px-4 py-3">{request.eventId ? eventNames[request.eventId] || request.eventFolio || "Evento no disponible" : "Fuera de evento"}</td>
                        <td className="max-w-56 px-4 py-3">{serviceNames[request.serviceId] || "Trámite no disponible"}</td>
                        <td className="max-w-56 px-4 py-3">{unitNames[request.unitId] || "Unidad no disponible"}</td>
                        <td className="max-w-48 px-4 py-3">{staffNames[request.applicantUserId] || "No identificado"}</td>
                        <td className="whitespace-nowrap px-4 py-3"><span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">{REQUEST_STATUS_LABELS[request.status] || request.status}</span></td>
                        <td className="px-4 py-3"><button type="button" onClick={() => router.push(`/admin/solicitud/${request.id}` as any)} className="rounded-lg border border-primary/30 px-3 py-2 font-semibold text-primary hover:bg-primary/10">Ver expediente</button></td>
                      </tr>
                    ))}
                    {!filteredRequests.length ? <tr><td colSpan={8} className="px-4 py-10 text-center text-zinc-500">No hay solicitudes que coincidan con el filtro seleccionado.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </View>
          </> : null}
          {section === "eventos" ? <>
            <View className="rounded-2xl border border-border bg-card p-5">
              <Text className="mb-1 text-xl font-bold">Eventos por municipio de Tabasco</Text>
              <Text className="mb-4 text-sm text-muted-foreground">Selecciona un municipio para consultar cuántos eventos y solicitudes se registraron. La intensidad del color representa la actividad.</Text>
              <Suspense fallback={<ActivityIndicator color="#981646" />}><MunicipalEventsMap events={(events.data || []) as AttentionEvent[]} requestCounts={eventRequestCountRecord} /></Suspense>
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
          {section === "reporte" ? <>
            <View className="rounded-2xl border border-border bg-card p-5">
              <Text className="text-xl font-bold">Seleccionar evento para reporte</Text>
              <Text className="mb-4 mt-1 text-sm text-muted-foreground">Busca por nombre, municipio, localidad o folio para consultar el reporte detallado de esa jornada.</Text>
              <Input value={exhibitionSearch} onChangeText={setExhibitionSearch} placeholder="Buscar evento..." />
              <View className="mt-3 max-h-52 gap-2 overflow-y-auto">
                {exhibitionEvents.map((event) => (
                  <Pressable key={event.id} onPress={() => setExhibitionEventId(event.id)} className={`grid grid-cols-[1.5fr_1fr_auto] items-center gap-3 rounded-xl border p-3 ${exhibitionEventId === event.id ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}>
                    <View><Text className="font-semibold">{event.name}</Text><Text className="text-xs text-muted-foreground">{event.folioPrefix} · {event.locality}, {event.municipality}</Text></View>
                    <Text className="text-sm">{formatEventDateTime(event.startsAt)}</Text>
                    <Text className="font-semibold text-primary">{(requests.data || []).filter((request) => request.eventId === event.id).length} solicitudes</Text>
                  </Pressable>
                ))}
                {!exhibitionEvents.length ? <Text className="py-5 text-center text-muted-foreground">No se encontraron eventos.</Text> : null}
              </View>
            </View>
            {exhibitionEvent ? <>
              <View className="overflow-hidden rounded-3xl border border-primary/20 bg-card p-6 shadow-sm">
                <View className="mb-5 flex-row items-start justify-between gap-4">
                  <View><Text className="text-xs font-bold uppercase tracking-wider text-primary">Reporte detallado del evento</Text><Text className="mt-1 text-3xl font-bold">{exhibitionEvent.name}</Text><Text className="mt-2 text-muted-foreground">Resultados territoriales y operativos de la jornada</Text></View>
                  <Text className={`rounded-full px-4 py-2 text-sm font-semibold ${getEventStatus(exhibitionEvent) === "Activo" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>{getEventStatus(exhibitionEvent)}</Text>
                </View>
                <Suspense fallback={<ActivityIndicator color="#981646" />}>
                  <SecretaryEventsMap
                    events={[exhibitionEvent] as AttentionEvent[]}
                    requestCounts={{ [exhibitionEvent.id]: exhibitionRequests.length }}
                    height={680}
                    autoSelect
                    immersive
                    fullscreenContent={<View className="mx-auto w-full max-w-7xl gap-6">
                      <View><Text className="text-xs font-bold uppercase tracking-wider text-primary">Resultados de la jornada</Text><Text className="mt-1 text-3xl font-bold">Todo lo realizado en {exhibitionEvent.name}</Text><Text className="mt-2 text-muted-foreground">Desplázate para consultar indicadores, gráficas y participación del personal.</Text></View>
                      <View className="flex-row flex-wrap gap-4">
                        <Metric label="Solicitudes generadas" value={exhibitionRequests.length} note="Total del evento" />
                        <Metric label="Trámites atendidos" value={exhibitionServices.length} note="Tipos con actividad" />
                        <Metric label="Unidades participantes" value={exhibitionUnits.length} note="Áreas involucradas" />
                        <Metric label="Capturistas" value={exhibitionStaff.length} note="Personal participante" />
                      </View>
                      <View className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
                        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Solicitudes por estatus</Text><StatusPieChart data={exhibitionStatus} /></View>
                        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Trámites solicitados</Text><RequestsBarChart data={exhibitionServices.slice(0, 8)} /></View>
                        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Participación de unidades</Text><RequestsBarChart data={exhibitionUnits.slice(0, 8)} /></View>
                        <View className="rounded-2xl border border-border bg-card p-5"><Text className="mb-4 text-xl font-bold">Rendimiento de capturistas</Text><View className="gap-2">{exhibitionStaff.map((member, index) => <View key={member.id} className="flex-row items-center rounded-xl bg-muted/50 p-3"><Text className="w-10 font-bold text-primary">#{index + 1}</Text><Text className="flex-1 font-semibold">{member.label}</Text><Text>{member.value} solicitudes</Text></View>)}{!exhibitionStaff.length ? <Text className="text-muted-foreground">Sin capturas registradas.</Text> : null}</View></View>
                      </View>
                      <View className="rounded-2xl border border-border bg-card p-5"><Text className="mb-4 text-xl font-bold">Solicitudes del evento</Text><View className="gap-2">{exhibitionRequests.map((request) => <View key={request.id} className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr] gap-3 rounded-xl bg-muted/50 p-3"><Text className="font-semibold">{request.folio}</Text><Text>{serviceNames[request.serviceId] || "Trámite no disponible"}</Text><Text>{unitNames[request.unitId] || "Unidad no disponible"}</Text><Text>{REQUEST_STATUS_LABELS[request.status] || request.status}</Text></View>)}</View></View>
                    </View>}
                  />
                </Suspense>
              </View>
              <View className="flex-row flex-wrap gap-4">
                <Metric label="Solicitudes generadas" value={exhibitionRequests.length} note="Total registrado en el evento" />
                <Metric label="Trámites solicitados" value={exhibitionServices.length} note="Tipos de trámite con actividad" />
                <Metric label="Unidades participantes" value={exhibitionUnits.length} note="Unidades que recibieron solicitudes" />
                <Metric label="Capturistas participantes" value={exhibitionStaff.length} note="Personal con registros" />
                <Metric label="Solicitudes concluidas" value={exhibitionRequests.filter((item) => item.status === "concluida").length} note={`${exhibitionRequests.length ? Math.round((exhibitionRequests.filter((item) => item.status === "concluida").length / exhibitionRequests.length) * 100) : 0}% de avance`} />
              </View>
              <View className="grid grid-cols-2 gap-4">
                <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Resultados por estatus</Text><Text className="mt-1 text-sm text-muted-foreground">Situación actual de las solicitudes del evento.</Text><StatusPieChart data={exhibitionStatus} /></View>
                <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Trámites atendidos</Text><Text className="mt-1 text-sm text-muted-foreground">Demanda registrada durante el evento.</Text><RequestsBarChart data={exhibitionServices.slice(0, 8)} /></View>
                <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Participación de unidades</Text><Text className="mt-1 text-sm text-muted-foreground">Solicitudes canalizadas a cada unidad.</Text><RequestsBarChart data={exhibitionUnits.slice(0, 8)} /></View>
                <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Trabajo de capturistas</Text><Text className="mb-4 mt-1 text-sm text-muted-foreground">Registros realizados en esta jornada.</Text><View className="gap-2">{exhibitionStaff.map((member, index) => <View key={member.id} className="flex-row items-center rounded-xl bg-muted/50 p-3"><Text className="w-10 font-bold text-primary">#{index + 1}</Text><Text className="flex-1 font-semibold">{member.label}</Text><Text>{member.value} solicitudes</Text></View>)}{!exhibitionStaff.length ? <Text className="text-muted-foreground">Sin capturas registradas.</Text> : null}</View></View>
              </View>
              <View className="rounded-2xl border border-border bg-card p-5">
                <Text className="text-xl font-bold">Solicitudes relacionadas</Text>
                <Text className="mb-4 mt-1 text-sm text-muted-foreground">Expedientes generados exclusivamente durante este evento.</Text>
                <View className="gap-2">{exhibitionRequests.map((request) => <Pressable key={request.id} onPress={() => router.push(`/admin/solicitud/${request.id}` as any)} className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr_auto] items-center gap-3 rounded-xl bg-muted/50 p-3"><View><Text className="font-semibold">{request.folio}</Text><Text className="text-xs text-muted-foreground">{new Date(request.requestedAt).toLocaleString("es-MX")}</Text></View><Text>{serviceNames[request.serviceId] || "Trámite no disponible"}</Text><Text>{unitNames[request.unitId] || "Unidad no disponible"}</Text><Text>{REQUEST_STATUS_LABELS[request.status] || request.status}</Text><Text className="font-semibold text-primary">Ver expediente →</Text></Pressable>)}{!exhibitionRequests.length ? <Text className="py-6 text-center text-muted-foreground">Este evento todavía no tiene solicitudes registradas.</Text> : null}</View>
              </View>
            </> : <View className="grid min-h-80 place-content-center rounded-2xl border border-dashed border-border bg-card text-center"><Text className="text-xl font-bold">Selecciona un evento</Text><Text className="mt-2 text-muted-foreground">Aquí aparecerá el reporte completo de la jornada.</Text></View>}
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
                  <Pressable onPress={() => router.push(`/admin/solicitud/${request.id}` as any)} className="rounded-lg border border-primary/30 px-3 py-2"><Text className="font-semibold text-primary">Ver seguimiento</Text></Pressable>
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
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    contactExtension: "",
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
    role: "super_admin" | "secretaria" | "capturista_secretaria" | "enlace" | "gestor" | "capturista";
    active: boolean;
  }>({ id: "", name: "", email: "", password: "", unitId: "", role: "capturista", active: true });
  const [eventForm, setEventForm] = useState<AttentionEventInput>(EMPTY_EVENT);
  const [globalFieldsDraft, setGlobalFieldsDraft] = useState<
    ServiceFormField[]
  >([]);
  const [ineAnalysisEnabled, setIneAnalysisEnabled] = useState(false);
  const [secretaryContact, setSecretaryContact] = useState({ name: "", email: "", phone: "", extension: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const [exhibitionSearch, setExhibitionSearch] = useState("");
  const [exhibitionEventId, setExhibitionEventId] = useState("");
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
    queryFn: requestsService.listAllAccessible,
    refetchOnWindowFocus: true,
  });
  const secretaryRequests = useQuery({
    queryKey: ["admin", "secretary-requests"],
    queryFn: identityApi.listSecretaryRequests,
    refetchOnWindowFocus: true,
  });
  const emailReport = useQuery({
    queryKey: ["admin", "email-delivery-report"],
    queryFn: identityApi.getEmailDeliveryReport,
    refetchOnWindowFocus: true,
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
  const serviceNames = useMemo(
    () => Object.fromEntries((services.data || []).map((service) => [service.id, service.name])),
    [services.data],
  );
  const staffNames = useMemo(
    () => Object.fromEntries((profiles.data || []).map((profile) => [profile.id, profile.name])),
    [profiles.data],
  );
  const exhibitionEvents = useMemo(() => {
    const term = exhibitionSearch.trim().toLocaleLowerCase("es-MX");
    return (events.data || []).filter((event) => !term
      || event.name.toLocaleLowerCase("es-MX").includes(term)
      || event.municipality.toLocaleLowerCase("es-MX").includes(term)
      || event.locality.toLocaleLowerCase("es-MX").includes(term)
      || event.folioPrefix.toLocaleLowerCase("es-MX").includes(term));
  }, [events.data, exhibitionSearch]);
  const exhibitionEvent = (events.data || []).find((event) => event.id === exhibitionEventId);
  const exhibitionRequests = useMemo<any[]>(() => [
    ...(requests.data || [])
      .filter((request) => request.eventId === exhibitionEventId)
      .map((request) => ({ ...request, isSecretary: false })),
    ...(secretaryRequests.data?.requests || [])
      .filter((request) => request.eventId === exhibitionEventId)
      .map((request) => ({
        ...request,
        isSecretary: true,
        serviceId: "secretaria",
        unitId: request.responsibleUnitId || "secretaria",
        applicantUserId: request.capturedByUserId,
        requestedAt: request.createdAt,
      })),
  ], [requests.data, secretaryRequests.data, exhibitionEventId]);
  const exhibitionStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of exhibitionRequests) counts.set(request.status, (counts.get(request.status) || 0) + 1);
    return [...counts.entries()].map(([status, value]) => ({ label: REQUEST_STATUS_LABELS[status] || status, value })).sort((a, b) => b.value - a.value);
  }, [exhibitionRequests]);
  const exhibitionServices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of exhibitionRequests) {
      const label = request.isSecretary ? (request.subject || "Oficio de Secretaría") : (serviceNames[request.serviceId] || "Trámite no disponible");
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [exhibitionRequests, serviceNames]);
  const exhibitionUnits = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of exhibitionRequests) {
      const label = request.isSecretary ? (unitNames[request.unitId] || "Secretaría") : (unitNames[request.unitId] || "Unidad no disponible");
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [exhibitionRequests, unitNames]);
  const exhibitionStaff = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of exhibitionRequests) {
      const id = request.applicantUserId || "sin-capturista";
      const label = request.isSecretary ? (request.capturedByName || "Capturista no identificado") : (staffNames[id] || "Capturista no identificado");
      const current = counts.get(`${id}|${label}`) || 0;
      counts.set(`${id}|${label}`, current + 1);
    }
    return [...counts.entries()].map(([key, value]) => ({ id: key.split("|")[0], label: key.split("|").slice(1).join("|"), value })).sort((a, b) => b.value - a.value);
  }, [exhibitionRequests, staffNames]);
  const demographicFieldKeys = useMemo(() => {
    const normalize = (value: string) => value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_-]+/g, " ")
      .toLocaleLowerCase("es-MX");
    const fields = globalForm.data?.fields || [];
    return {
      age: fields
        .filter((field) => /(^|\W)(edad|age)(\W|$)/.test(normalize(`${field.key} ${field.label}`)))
        .map((field) => field.key),
      gender: fields
        .filter((field) => /(^|\W)(genero|sexo|gender)(\W|$)/.test(normalize(`${field.key} ${field.label}`)))
        .map((field) => field.key),
    };
  }, [globalForm.data?.fields]);
  const exhibitionAges = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of exhibitionRequests) {
      const data = request.applicantData || {};
      const dynamicKey = demographicFieldKeys.age.find((key) => String(data[key] ?? "").trim());
      const fallbackEntry = Object.entries(data).find(([key, value]) =>
        /(^|\W)(edad|age)(\W|$)/.test(key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").toLocaleLowerCase("es-MX"))
        && String(value ?? "").trim(),
      );
      const age = dynamicKey ? data[dynamicKey] : fallbackEntry?.[1];
      if (age) counts.set(String(age), (counts.get(String(age)) || 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => Number(a.label) - Number(b.label));
  }, [exhibitionRequests, demographicFieldKeys.age]);
  const exhibitionGenders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of exhibitionRequests) {
      const data = request.applicantData || {};
      const dynamicKey = demographicFieldKeys.gender.find((key) => String(data[key] ?? "").trim());
      const fallbackEntry = Object.entries(data).find(([key, value]) =>
        /(^|\W)(genero|sexo|gender)(\W|$)/.test(key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").toLocaleLowerCase("es-MX"))
        && String(value ?? "").trim(),
      );
      const gender = dynamicKey ? data[dynamicKey] : fallbackEntry?.[1];
      if (gender) counts.set(String(gender), (counts.get(String(gender)) || 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [exhibitionRequests, demographicFieldKeys.gender]);

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
      setNotice(
        invite.id && invite.password
          ? "Usuario actualizado y contraseña restablecida correctamente."
          : "Usuario guardado y relacionado correctamente.",
      );
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
  
  const exportCsv = () => {
    if (!exhibitionEventId) return;
    const escape = (value: unknown) => '"' + String(value ?? "").replaceAll('"', '""') + '"';
    const rows = exhibitionRequests.map((request) => [
      request.folio || "—",
      request.isSecretary ? (request.subject || "Oficio de Secretaría") : (serviceNames[request.serviceId] || request.serviceId),
      request.isSecretary ? "Secretaría" : (unitNames[request.unitId] || request.unitId),
      request.isSecretary ? "Oficio" : "Trámite",
      request.isSecretary ? (request.createdAt ? new Date(request.createdAt).toLocaleString("es-MX") : "—") : (request.requestedAt ? new Date(request.requestedAt).toLocaleString("es-MX") : "—"),
      (request.status || "").replaceAll("_", " "),
      request.isSecretary ? (request.capturedByName || "No identificado") : (staffNames[request.applicantUserId] || "No identificado"),
    ]);
    const csv = [
      ["Folio", "Trámite/Asunto", "Unidad", "Tipo", "Fecha", "Estatus", "Capturista"],
      ...rows,
    ].map((row) => row.map(escape).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = "reporte-evento-" + (exhibitionEvent?.folioPrefix || "general") + ".csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const saveGlobalForm = useMutation({
    mutationFn: () => {
      if (!globalForm.data)
        throw new Error("No se cargó la configuración global");
      return adminService.saveGlobalForm({
        ...globalForm.data,
        version: globalForm.data.version + 1,
        enableINEAnalysis: ineAnalysisEnabled,
        secretaryContact,
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
    setUnitForm({ id: "", code: "", name: "", description: "", contactName: "", contactEmail: "", contactPhone: "", contactExtension: "", active: true });
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
    setSecretaryContact({
      name: globalForm.data?.secretaryContact?.name || "",
      email: globalForm.data?.secretaryContact?.email || "",
      phone: globalForm.data?.secretaryContact?.phone || "",
      extension: globalForm.data?.secretaryContact?.extension || "",
    });
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
    secretaryRequests.isLoading ||
    emailReport.isLoading ||
    events.isLoading ||
    globalForm.isLoading;
  const statusChartData = useMemo<DashboardChartDatum[]>(() => {
    const counts = new Map<string, number>();
    for (const request of requests.data || []) {
      const label = (request.status || "sin estatus")
        .replaceAll("_", " ")
        .replace(/^./, (letter) => letter.toUpperCase());
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return Array.from(counts, ([label, value]) => ({ label, value }));
  }, [requests.data]);
  const serviceChartData = useMemo<DashboardChartDatum[]>(() => {
    const counts = new Map<string, number>();
    const names = Object.fromEntries(
      (services.data || []).map((service) => [service.id, service.name]),
    );
    for (const request of requests.data || []) {
      const label = names[request.serviceId] || "Trámite no disponible";
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return Array.from(counts, ([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [requests.data, services.data]);

  return (
    <View className="h-screen flex-row bg-muted/30">
      <View className="w-72 border-r border-border bg-card p-5">
        <View className="mb-8 border-b border-border pb-5">
          <Text className="text-xl font-bold text-primary">Atencio Ciudadana</Text>
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
              <Monicon
                name={item.icon}
                size={20}
                color={section === item.key ? "#ffffff" : "#71717a"}
              />
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
          <View className="mb-4 flex-row items-center gap-3">
            <View className="min-w-0 flex-1">
              <Text className="font-semibold" numberOfLines={1}>{user?.nombre}</Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                Rol: Superadministrador
              </Text>
            </View>
            <SidebarThemeButton />
          </View>
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
          <View className="flex-row gap-3">
            <AdminRefreshButton queryKey="admin" />
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
                      value={(requests.data?.length || 0) + (secretaryRequests.data?.requests.length || 0)}
                      note={`${requests.data?.length || 0} normales · ${secretaryRequests.data?.requests.length || 0} de Secretaría`}
                    />
                  </View>
                  <View className="grid grid-cols-2 gap-4">
                    <View className="rounded-2xl border border-border bg-card p-6">
                      <Text className="text-lg font-bold">Solicitudes por estatus</Text>
                      <Text className="mt-1 text-sm text-muted-foreground">
                        Distribución actual de los registros.
                      </Text>
                      <StatusPieChart data={statusChartData} />
                    </View>
                    <View className="rounded-2xl border border-border bg-card p-6">
                      <Text className="text-lg font-bold">Trámites más solicitados</Text>
                      <Text className="mt-1 text-sm text-muted-foreground">
                        Los seis trámites con mayor demanda.
                      </Text>
                      <RequestsBarChart data={serviceChartData} />
                    </View>
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
                  <View className="gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5">
                    <View>
                      <Text className="font-bold">Contacto de Secretaría</Text>
                      <Text className="mt-1 text-xs text-muted-foreground">Esta información aparecerá en los comprobantes enviados por correo.</Text>
                    </View>
                    <Field label="Nombre o área responsable" value={secretaryContact.name} onChangeText={(name) => setSecretaryContact((current) => ({ ...current, name }))} placeholder="Ej. Oficina de la Titular" />
                    <View className="grid grid-cols-2 gap-4">
                      <Field label="Correo de contacto" value={secretaryContact.email} onChangeText={(email) => setSecretaryContact((current) => ({ ...current, email }))} placeholder="secretaria@tabasco.gob.mx" />
                      <Field label="Teléfono" value={secretaryContact.phone} onChangeText={(phone) => setSecretaryContact((current) => ({ ...current, phone }))} placeholder="993 000 0000" />
                    </View>
                    <Field label="Extensión (opcional)" value={secretaryContact.extension} onChangeText={(extension) => setSecretaryContact((current) => ({ ...current, extension }))} placeholder="1234" />
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
                                      ? {
                                        ...item,
                                        type,
                                        ...(type === "file" && !item.fileType
                                          ? { fileType: "any" as const }
                                          : {}),
                                      }
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
                        {field.type === "file" ? (
                          <View className="gap-2 rounded-xl border border-border bg-muted/40 p-4">
                            <Text className="text-sm font-semibold">
                              Tipo de archivo permitido
                            </Text>
                            <select
                              value={field.fileType || "any"}
                              onChange={(event) => {
                                const fileType = event.currentTarget.value as ServiceFormField["fileType"];
                                setGlobalFieldsDraft((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, fileType } : item,
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
                              <option value="any">Documentos e imágenes</option>
                              <option value="document">Solo documentos (PDF, Word y Excel)</option>
                              <option value="image">Solo imágenes (JPG y PNG)</option>
                            </select>
                            <Text className="text-xs text-muted-foreground">
                              Esta selección controla los archivos que podrá adjuntar la persona durante la captura.
                            </Text>
                          </View>
                        ) : null}
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
                <AdminDataTable
                  data={events.data || []}
                  getRowId={(item) => item.id}
                  searchPlaceholder="Buscar evento, folio o municipio..."
                  emptyMessage="Todavía no hay eventos registrados."
                  filterLabel="Todos los estados"
                  filterOptions={["Activo", "Próximo", "Finalizado"].map((value) => ({ label: value, value }))}
                  getFilterValue={getEventStatus}
                  columns={[
                    { key: "name", title: "EVENTO", value: (item) => item.name, render: (item) => <View><Text className="font-semibold">{item.name}</Text><Text className="text-xs text-muted-foreground">Folio {item.folioPrefix}</Text></View> },
                    { key: "place", title: "LOCALIDAD / MUNICIPIO", value: (item) => `${item.locality} ${item.municipality}`, render: (item) => <View><Text>{item.locality}</Text><Text className="text-xs text-muted-foreground">{item.municipality}</Text></View> },
                    { key: "date", title: "FECHA Y HORA", value: (item) => new Date(item.startsAt).getTime(), render: (item) => <Text className="text-sm">{formatEventDateTime(item.startsAt)}</Text> },
                    { key: "status", title: "ESTADO", value: getEventStatus, render: (item) => <Text className={`font-semibold ${getEventStatus(item) === "Activo" ? "text-emerald-600" : "text-muted-foreground"}`}>{getEventStatus(item)}</Text> },
                  ]}
                  renderActions={(item) => <View className="flex-row justify-end gap-2"><Button size="sm" variant="outline" onPress={() => { setEventForm(item); setEventModal(true); }}><Text>Editar</Text></Button>{getEventStatus(item) !== "Finalizado" ? <Button size="sm" variant="outline" disabled={finishEvent.isPending} onPress={() => finishEvent.mutate(item.id)}><Text>Finalizar</Text></Button> : null}</View>}
                />
              )}
              {section === "unidades" && (
                <AdminDataTable
                  data={units.data || []}
                  getRowId={(item) => item.id}
                  searchPlaceholder="Buscar unidad, clave o contacto..."
                  filterLabel="Todos los estados"
                  filterOptions={[{ label: "Activas", value: "active" }, { label: "Inactivas", value: "inactive" }]}
                  getFilterValue={(item) => item.active ? "active" : "inactive"}
                  emptyMessage="No hay unidades administrativas."
                  columns={[
                    { key: "code", title: "CLAVE", value: (item) => item.code, width: 130 },
                    { key: "name", title: "UNIDAD ADMINISTRATIVA", value: (item) => `${item.name} ${item.description || ""}`, render: (item) => <View><Text className="font-semibold">{item.name}</Text><Text className="text-xs text-muted-foreground">{item.description || "Sin descripción"}</Text></View> },
                    { key: "contact", title: "CONTACTO", value: (item) => item.contactEmail || "—", width: 260 },
                    { key: "status", title: "ESTADO", value: (item) => item.active ? "Activa" : "Inactiva", width: 110, render: (item) => <Text className={`font-semibold ${item.active ? "text-emerald-600" : "text-muted-foreground"}`}>{item.active ? "Activa" : "Inactiva"}</Text> },
                  ]}
                  renderActions={(item) => <Button size="sm" variant="outline" onPress={() => { setUnitForm({ id: item.id, code: item.code, name: item.name, description: item.description || "", contactName: item.contactName || "", contactEmail: item.contactEmail || "", contactPhone: item.contactPhone || "", contactExtension: item.contactExtension || "", active: item.active }); setUnitModal(true); }}><Text>Editar</Text></Button>}
                />
              )}
              {section === "tramites" && (
                <AdminDataTable
                  data={services.data || []}
                  getRowId={(item) => item.id}
                  searchPlaceholder="Buscar trámite, clave o unidad..."
                  filterLabel="Todos los tipos"
                  filterOptions={["tramite", "servicio", "programa"].map((value) => ({ label: value[0].toUpperCase() + value.slice(1), value }))}
                  getFilterValue={(item) => item.type}
                  columns={[
                    { key: "code", title: "CLAVE", value: (item) => item.code, width: 120 },
                    { key: "name", title: "NOMBRE", value: (item) => `${item.name} ${item.type}`, render: (item) => <View><Text className="font-semibold">{item.name}</Text><Text className="text-xs capitalize text-muted-foreground">{item.type}</Text></View> },
                    { key: "unit", title: "UNIDAD", value: (item) => unitNames[item.unitId] || item.unitId, width: 260 },
                    { key: "status", title: "ESTADO", value: (item) => item.active ? "Activo" : "Inactivo", width: 110, render: (item) => <Text className={`font-semibold ${item.active ? "text-emerald-600" : "text-muted-foreground"}`}>{item.active ? "Activo" : "Inactivo"}</Text> },
                  ]}
                  renderActions={(item) => <Button size="sm" variant="outline" onPress={() => openEdit(item)}><Text>Editar</Text></Button>}
                />
              )}
              {section === "usuarios" && (
                <View className="gap-5">

                  <AdminDataTable
                    data={profiles.data || []}
                    getRowId={(item) => item.id}
                    searchPlaceholder="Buscar usuario, correo o unidad..."
                    filterLabel="Todos los roles"
                    filterOptions={["capturista", "capturista_secretaria", "gestor", "enlace", "secretaria", "super_admin"].map((value) => ({ label: ROLE_DETAILS[value as keyof typeof ROLE_DETAILS].title, value }))}
                    getFilterValue={(item) => item.role}
                    columns={[
                      { key: "name", title: "USUARIO", value: (item) => `${item.name} ${item.email}`, render: (item) => <View><Text className="font-semibold">{item.name}</Text><Text className="text-xs text-muted-foreground">{item.email}</Text></View> },
                      { key: "role", title: "ROL", value: (item) => item.role, width: 190, render: (item) => <Text>{ROLE_DETAILS[item.role as keyof typeof ROLE_DETAILS]?.title || item.role.replace("_", " ")}</Text> },
                      { key: "unit", title: "UNIDAD", value: (item) => item.unitId ? unitNames[item.unitId] : "Acceso global", width: 260 },
                      { key: "status", title: "ESTADO", value: (item) => item.active ? "Activo" : "Inactivo", width: 100, render: (item) => <Text className={`font-semibold ${item.active ? "text-emerald-600" : "text-red-600"}`}>{item.active ? "Activo" : "Inactivo"}</Text> },
                    ]}
                    renderActions={(item) => item.role === "super_admin" ? <Text className="text-xs text-muted-foreground">Protegido</Text> : <Button size="sm" variant="outline" onPress={() => { setInvite({ id: item.id, name: item.name, email: item.email, password: "", unitId: item.unitId || units.data?.[0]?.id || "", role: item.role as "secretaria" | "capturista_secretaria" | "enlace" | "gestor" | "capturista", active: item.active }); setUserModal(true); }}><Text>Administrar</Text></Button>}
                  />
                </View>
              )}
              {section === "solicitudes" && (
                <View className="gap-6">
                  <View>
                    <Text className="text-xl font-bold">Solicitudes normales</Text>
                    <Text className="mb-4 mt-1 text-sm text-muted-foreground">
                      Trámites y servicios registrados por el personal capturista.
                    </Text>
                  <AdminDataTable
                    data={requests.data || []}
                    getRowId={(item) => item.id}
                    searchPlaceholder="Buscar folio, unidad o estatus..."
                    filterLabel="Todos los eventos"
                    filterOptions={(events.data || []).map((event) => ({ label: event.name, value: event.id }))}
                    getFilterValue={(item) => item.eventId || ""}
                    emptyMessage="No hay solicitudes registradas."
                    columns={[
                      { key: "folio", title: "FOLIO", value: (item) => item.folio || item.programFolio || "—" },
                      { key: "eventFolio", title: "FOLIO EVENTO", value: (item) => item.eventFolio || "—", width: 170 },
                      { key: "unit", title: "UNIDAD", value: (item) => unitNames[item.unitId] || item.unitId || "—", width: 240 },
                      { key: "date", title: "FECHA", value: (item) => item.requestedAt ? new Date(item.requestedAt).getTime() : 0, width: 140, render: (item) => <Text>{item.requestedAt ? new Date(item.requestedAt).toLocaleDateString("es-MX") : "—"}</Text> },
                      { key: "status", title: "ESTATUS", value: (item) => item.status || "", width: 160, render: (item) => <Text className="capitalize text-primary">{(item.status || "").replaceAll("_", " ")}</Text> },
                    ]}
                    renderActions={(item) => <Button size="sm" variant="outline" onPress={() => router.push(`/admin/solicitud/${item.id}` as any)}><Text>Ver detalle</Text></Button>}
                  />
                  </View>
                  <View>
                    <Text className="text-xl font-bold">Solicitudes de Secretaría</Text>
                    <Text className="mb-4 mt-1 text-sm text-muted-foreground">
                      Solicitudes prioritarias capturadas por Secretaría, sus representantes o el Enlace.
                    </Text>
                    <AdminDataTable
                      data={secretaryRequests.data?.requests || []}
                      getRowId={(item) => item.id}
                      searchPlaceholder="Buscar folio, asunto o capturista..."
                      filterLabel="Todos los eventos"
                      filterOptions={(events.data || []).map((event) => ({ label: event.name, value: event.id }))}
                      getFilterValue={(item) => item.eventId || ""}
                      emptyMessage="No hay solicitudes de Secretaría registradas."
                      columns={[
                        { key: "folio", title: "FOLIO", value: (item) => item.folio || "—" },
                        { key: "eventFolio", title: "FOLIO EVENTO", value: (item) => item.eventFolio || "—", width: 170 },
                        { key: "subject", title: "ASUNTO", value: (item) => item.subject || "—", width: 280 },
                        { key: "capturedBy", title: "CAPTURÓ", value: (item) => item.capturedByName || "—", width: 210 },
                        { key: "date", title: "FECHA", value: (item) => item.createdAt ? new Date(item.createdAt).getTime() : 0, width: 140, render: (item) => <Text>{item.createdAt ? new Date(item.createdAt).toLocaleDateString("es-MX") : "—"}</Text> },
                        { key: "status", title: "ESTATUS", value: (item) => item.status || "", width: 180, render: (item) => <Text className="capitalize text-primary">{(item.status || "").replaceAll("_", " ")}</Text> },
                      ]}
                      renderActions={(item) => <Button size="sm" variant="outline" onPress={() => router.push(`/admin/solicitud-secretaria/${item.id}` as any)}><Text>Ver y editar</Text></Button>}
                    />
                  </View>
                </View>
              )}
              
              {section === "reportes" && (
                <View className="gap-6">
                  <View className="rounded-2xl border border-border bg-card p-5">
                    <Text className="text-xl font-bold">Seleccionar evento para reporte</Text>
                    <Text className="mb-4 mt-1 text-sm text-muted-foreground">Busca por nombre, municipio o folio para consultar el reporte detallado que incluye trámites y oficios de Secretaría.</Text>
                    <Input value={exhibitionSearch} onChangeText={setExhibitionSearch} placeholder="Buscar evento..." />
                    <View className="mt-3 max-h-52 gap-2 overflow-y-auto">
                      {exhibitionEvents.map((event) => (
                        <Pressable key={event.id} onPress={() => setExhibitionEventId(event.id)} className={"grid grid-cols-[1.5fr_1fr_auto] items-center gap-3 rounded-xl border p-3 " + (exhibitionEventId === event.id ? "border-primary bg-primary/10" : "border-border bg-muted/30")}>
                          <View><Text className="font-semibold">{event.name}</Text><Text className="text-xs text-muted-foreground">{event.folioPrefix} · {event.locality}, {event.municipality}</Text></View>
                          <Text className="text-sm">{new Date(event.startsAt).toLocaleDateString("es-MX")}</Text>
                          <Text className="font-semibold text-primary">Seleccionar</Text>
                        </Pressable>
                      ))}
                      {!exhibitionEvents.length ? <Text className="py-5 text-center text-muted-foreground">No se encontraron eventos.</Text> : null}
                    </View>
                  </View>
                  {exhibitionEvent ? (
                    <View className="overflow-hidden rounded-3xl border border-primary/20 bg-card p-6 shadow-sm">
                      <View className="mb-5 flex-row items-start justify-between gap-4">
                        <View><Text className="text-xs font-bold uppercase tracking-wider text-primary">Reporte detallado consolidado</Text><Text className="mt-1 text-3xl font-bold">{exhibitionEvent.name}</Text><Text className="mt-2 text-muted-foreground">Resultados territoriales integrando capturas de áreas y de Secretaría.</Text></View>
                        <Button onPress={exportCsv}><Text>Exportar reporte completo (CSV)</Text></Button>
                      </View>
                      <View className="flex-row flex-wrap gap-4">
                        <View className="flex-1 min-w-[150px] rounded-xl border border-border bg-muted/30 p-4"><Text className="text-sm text-muted-foreground">Total de atenciones</Text><Text className="text-2xl font-bold text-primary">{exhibitionRequests.length}</Text></View>
                        <View className="flex-1 min-w-[150px] rounded-xl border border-border bg-muted/30 p-4"><Text className="text-sm text-muted-foreground">Áreas / Unidades</Text><Text className="text-2xl font-bold">{exhibitionUnits.length}</Text></View>
                        <View className="flex-1 min-w-[150px] rounded-xl border border-border bg-muted/30 p-4"><Text className="text-sm text-muted-foreground">Capturistas</Text><Text className="text-2xl font-bold">{exhibitionStaff.length}</Text></View>
                      </View>
                      <View className="mt-6 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
                        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Solicitudes por estatus</Text><View className="mt-4"><StatusPieChart data={exhibitionStatus} /></View></View>
                        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Demografía: Edades</Text><Text className="mt-1 text-xs text-muted-foreground">Datos extraídos del formulario global.</Text><View className="mt-4"><RequestsBarChart data={exhibitionAges} /></View></View>
                        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Demografía: Género</Text><Text className="mt-1 text-xs text-muted-foreground">Datos extraídos del formulario global.</Text><View className="mt-4"><StatusPieChart data={exhibitionGenders} /></View></View>
                        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Trámites y oficios solicitados</Text><View className="mt-4"><RequestsBarChart data={exhibitionServices.slice(0, 8)} /></View></View>
                        <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Participación de unidades</Text><View className="mt-4"><RequestsBarChart data={exhibitionUnits.slice(0, 8)} /></View></View>
                        <View className="rounded-2xl border border-border bg-card p-5"><Text className="mb-4 text-xl font-bold">Rendimiento de capturistas</Text><View className="gap-2">{exhibitionStaff.map((member, index) => <View key={member.id} className="flex-row items-center rounded-xl bg-muted/50 p-3"><Text className="w-10 font-bold text-primary">#{index + 1}</Text><Text className="flex-1 font-semibold">{member.label}</Text><Text>{member.value} atenciones</Text></View>)}{!exhibitionStaff.length ? <Text className="text-muted-foreground">Sin capturas registradas.</Text> : null}</View></View>
                      </View>
                    </View>
                  ) : (
                    <View className="grid min-h-60 place-content-center rounded-2xl border border-dashed border-border bg-card text-center"><Text className="text-xl font-bold">Selecciona un evento</Text><Text className="mt-2 text-muted-foreground">Aquí aparecerá el reporte consolidado de la jornada.</Text></View>
                  )}
                </View>
              )}

              {section === "correos" && (
                <View className="gap-5">
                  <View className="flex-row flex-wrap gap-4">
                    <Metric label="Con correo enviado" value={(emailReport.data?.items || []).filter((item) => item.sent).length} note="Último intento exitoso" />
                    <Metric label="Sin envío" value={(emailReport.data?.items || []).filter((item) => !item.sent).length} note="Sin correo o con error" />
                    <Metric label="Correo modificado" value={(emailReport.data?.items || []).filter((item) => item.emailChanged).length} note="Requieren reenvío al correo nuevo" />
                  </View>
                  <AdminDataTable
                    data={emailReport.data?.items || []}
                    getRowId={(item) => `${item.requestType}-${item.id}`}
                    searchPlaceholder="Buscar folio o correo..."
                    filterLabel="Todos los estados"
                    filterOptions={[
                      { label: "Enviado", value: "enviado" },
                      { label: "No enviado", value: "no_enviado" },
                      { label: "Correo modificado", value: "modificado" },
                    ]}
                    getFilterValue={(item) => item.emailChanged ? "modificado" : item.sent ? "enviado" : "no_enviado"}
                    emptyMessage="Todavía no hay información de envíos de correo."
                    columns={[
                      { key: "folio", title: "FOLIO", value: (item) => item.folio },
                      { key: "type", title: "TIPO", value: (item) => item.requestType, width: 130, render: (item) => <Text className="capitalize">{item.requestType}</Text> },
                      { key: "currentEmail", title: "CORREO ACTUAL", value: (item) => item.currentEmail || "Sin correo", width: 250 },
                      { key: "sentEmail", title: "ÚLTIMO DESTINATARIO", value: (item) => item.lastSentEmail || "—", width: 250 },
                      { key: "date", title: "ÚLTIMO INTENTO", value: (item) => item.lastAttemptAt ? new Date(item.lastAttemptAt).getTime() : 0, width: 170, render: (item) => <Text>{item.lastAttemptAt ? new Date(item.lastAttemptAt).toLocaleString("es-MX") : "Sin registro"}</Text> },
                      { key: "status", title: "RESULTADO", value: (item) => item.emailChanged ? "Correo modificado" : item.sent ? "Enviado" : item.error || "No enviado", width: 190, render: (item) => <Text className={item.emailChanged ? "font-semibold text-amber-700" : item.sent ? "font-semibold text-emerald-700" : "font-semibold text-destructive"}>{item.emailChanged ? "Requiere reenvío" : item.sent ? "Enviado" : item.error || "No enviado"}</Text> },
                    ]}
                    renderActions={(item) => <Button size="sm" variant="outline" onPress={() => router.push(item.requestType === "secretaria" ? `/admin/solicitud-secretaria/${item.id}` as any : `/admin/solicitud/${item.id}` as any)}><Text>{item.emailChanged ? "Revisar y reenviar" : "Ver solicitud"}</Text></Button>}
                  />
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
          <View className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-background">
            <View className="border-b border-border px-7 py-5">
              <Text className="text-2xl font-bold">{unitForm.id ? "Editar" : "Nueva"} unidad administrativa</Text>
              <Text className="mt-1 text-sm text-muted-foreground">Los gestores y trámites se relacionarán con esta unidad.</Text>
            </View>
            <ScrollView className="min-h-0 flex-1" contentContainerStyle={{ padding: 28, gap: 20 }}>
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
              <Field label="Encargado del área (opcional)" value={unitForm.contactName} onChangeText={(contactName) => setUnitForm({ ...unitForm, contactName })} placeholder="Nombre completo" />
              <View className="grid grid-cols-[1fr_1fr_120px] gap-4">
                <Field label="Correo de contacto (opcional)" value={unitForm.contactEmail} onChangeText={(contactEmail) => setUnitForm({ ...unitForm, contactEmail })} placeholder="unidad@tabasco.gob.mx" />
                <Field label="Teléfono (opcional)" value={unitForm.contactPhone} onChangeText={(contactPhone) => setUnitForm({ ...unitForm, contactPhone })} placeholder="993 000 0000" />
                <Field label="Extensión" value={unitForm.contactExtension} onChangeText={(contactExtension) => setUnitForm({ ...unitForm, contactExtension })} placeholder="1234" />
              </View>
              <View className="flex-row items-center justify-between rounded-xl bg-muted p-4">
                <View><Text className="font-semibold">Unidad activa</Text><Text className="text-xs text-muted-foreground">Las unidades activas pueden recibir trámites y gestores.</Text></View>
                <Switch value={unitForm.active} onValueChange={(active) => setUnitForm({ ...unitForm, active })} />
              </View>
            </ScrollView>
            <View className="flex-row justify-end gap-3 border-t border-border px-7 py-5">
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
          <View className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-background">
            <View className="border-b border-border px-7 py-5">
              <Text className="text-2xl font-bold">
                {form.id ? "Editar" : "Nuevo"} trámite
              </Text>
            </View>
            <ScrollView className="min-h-0 flex-1" contentContainerStyle={{ padding: 28, gap: 16 }}>
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
                <View className="flex-row flex-wrap gap-2">
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
                <Image
                  accessibilityLabel={form.name || "Imagen del trámite"}
                  source={
                    form.imageUrl
                      ? { uri: form.imageUrl }
                      : DEFAULT_SERVICE_IMAGE
                  }
                  resizeMode={form.imageUrl ? "cover" : "contain"}
                  style={{
                    width: 180,
                    height: 110,
                    borderRadius: 10,
                    backgroundColor: "#ffffff",
                  }}
                />
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
              <View className="grid grid-cols-4 gap-4">
                <Field
                  label="Responsable del trámite (opcional)"
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
                <Field
                  label="Extensión"
                  value={form.contactExtension || ""}
                  onChangeText={(contactExtension) =>
                    setForm({ ...form, contactExtension })
                  }
                  placeholder="1234"
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
            </ScrollView>
            <View className="flex-row justify-end gap-3 border-t border-border px-7 py-5">
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
          <View className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-background">
            <View className="border-b border-border px-7 py-5">
              <Text className="text-2xl font-bold">
                {eventForm.id ? "Editar evento" : "Crear evento de atención"}
              </Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Selecciona un punto en el mapa para guardar la ubicación
                exacta.
              </Text>
            </View>
            <ScrollView className="min-h-0 flex-1" contentContainerStyle={{ padding: 28, gap: 18 }}>
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
            </ScrollView>
            <View className="flex-row justify-end gap-3 border-t border-border px-7 py-5">
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
          <View className="h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-background">
            <View className="border-b border-border px-7 py-5">
              <Text className="text-2xl font-bold">
                {invite.id ? "Editar usuario institucional" : "Nuevo usuario institucional"}
              </Text>
            </View>
            <ScrollView className="min-h-0 flex-1" contentContainerStyle={{ padding: 28, gap: 20 }}>
              <View className="gap-2">
                <Text className="text-sm font-semibold">Rol</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(["capturista", "capturista_secretaria", "gestor", "enlace", "secretaria", "super_admin"] as const).map((role) => (
                    <Pressable
                      key={role}
                      onPress={() => setInvite({ ...invite, role })}
                      className={`min-w-[130px] flex-1 rounded-xl border p-3 ${invite.role === role ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      <Text className="text-center">{ROLE_DETAILS[role].title}</Text>
                    </Pressable>
                  ))}
                </View>
                <View className="rounded-xl bg-muted/60 p-3">
                  <Text className="text-sm font-semibold">
                    {ROLE_DETAILS[invite.role].title}
                  </Text>
                  <Text className="mt-1 text-xs leading-5 text-muted-foreground">
                    {ROLE_DETAILS[invite.role].description}
                  </Text>
                </View>
                {invite.role === "super_admin" ? (
                  <Text className="text-xs font-semibold text-amber-700">
                    Este usuario tendrá control total del sistema. Verifica cuidadosamente su correo antes de crearlo.
                  </Text>
                ) : null}
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
              <View className="gap-1">
                <Field
                  label={invite.id ? "Nueva contraseña (opcional)" : "Contraseña temporal"}
                  value={invite.password}
                  onChangeText={(password) => setInvite({ ...invite, password })}
                  placeholder={invite.id ? "Déjala vacía para conservar la contraseña actual" : "Mínimo 8 caracteres"}
                  secureTextEntry
                />
                {invite.id ? (
                  <Text className="text-xs text-muted-foreground">
                    La contraseña solo se restablecerá si escribes una nueva, con al menos 8 caracteres.
                  </Text>
                ) : null}
              </View>
              {invite.role === "gestor" || invite.role === "capturista" ? (
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
            </ScrollView>
            <View className="flex-row justify-end gap-3 border-t border-border px-7 py-5">
              <Button variant="outline" onPress={() => setUserModal(false)}>
                <Text>Cancelar</Text>
              </Button>
              <Button
                disabled={
                  createUser.isPending ||
                  !invite.name ||
                  !invite.email.endsWith("@tabasco.gob.mx") ||
                  (!invite.id && invite.password.length < 8) ||
                  (!!invite.id && invite.password.length > 0 && invite.password.length < 8) ||
                   ((invite.role === "gestor" || invite.role === "capturista") && !invite.unitId)
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
