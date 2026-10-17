import { adminService } from "@/src/services/admin";
import { identityApi } from "@/src/services/identityApi";
import { requestsService } from "@/src/services/requests";
import type { AttentionEvent } from "@/src/types/catalog";
import { getEventStatus, type EventStatus } from "@/src/utils/eventStatus";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export type ReportKind = "all" | "regular" | "secretary";

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  all: "Trámites y Atención de Secretaría",
  regular: "Solo trámites",
  secretary: "Solo Atención de Secretaría",
};

export interface ReportDatum {
  key: string;
  label: string;
  value: number;
}

/** Dato desglosado por tipo: trámite del catálogo o Atención de Secretaría. */
export interface SplitDatum extends ReportDatum {
  regular: number;
  secretary: number;
}

export interface ReportEvent extends AttentionEvent {
  status: EventStatus;
  requestCount: number;
}

/** Mismas etiquetas que el panel web de Secretaría. */
export const REPORT_STATUS_LABELS: Record<string, string> = {
  enviada: "Nueva",
  en_espera_apertura: "En espera de apertura",
  recibida: "Recibida",
  en_revision: "En seguimiento",
  en_atencion: "En atención",
  requiere_informacion: "Requiere información",
  pendiente_canalizacion: "Pendiente de canalización",
  canalizada: "Canalizada",
  atendida: "Atendida",
  aprobada: "Aprobada",
  rechazada: "No procedió",
  cancelada: "No continuó",
  concluida: "Concluida",
  borrador: "Borrador",
};

const statusText = (status: string) =>
  REPORT_STATUS_LABELS[status] ?? status.replaceAll("_", " ");

/** Fila común para trámites regulares y solicitudes de Secretaría. */
interface ReportRow {
  kind: "regular" | "secretary";
  eventId?: string;
  serviceId?: string;
  capturedById: string;
  capturedByName: string;
  status: string;
  priority: boolean;
}

const sortData = <T extends ReportDatum>(data: T[]) =>
  data.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

const countBy = (rows: ReportRow[], keyOf: (row: ReportRow) => string | undefined, labelOf: (key: string) => string) => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return sortData([...counts.entries()].map(([key, value]) => ({ key, label: labelOf(key), value })));
};

const splitBy = (rows: ReportRow[], keyOf: (row: ReportRow) => string | undefined, labelOf: (key: string) => string) => {
  const counts = new Map<string, { regular: number; secretary: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const current = counts.get(key) || { regular: 0, secretary: 0 };
    current[row.kind] += 1;
    counts.set(key, current);
  }
  return sortData([...counts.entries()].map(([key, value]) => ({
    key,
    label: labelOf(key),
    value: value.regular + value.secretary,
    ...value,
  })));
};

/** Datos agregados del módulo de Reportes (Superadministrador y Secretaría). */
export function useReportes(eventId: string, kind: ReportKind) {
  const requests = useQuery({
    queryKey: ["reportes", "requests"],
    queryFn: requestsService.listAllAccessible,
  });
  const secretaryRequests = useQuery({
    queryKey: ["reportes", "secretary-requests"],
    queryFn: identityApi.listSecretaryRequests,
  });
  const services = useQuery({ queryKey: ["reportes", "services"], queryFn: adminService.listServices });
  const events = useQuery({ queryKey: ["reportes", "events"], queryFn: adminService.listEvents });
  const staff = useQuery({ queryKey: ["reportes", "staff"], queryFn: identityApi.getReportingStaff });

  const serviceNames = useMemo(
    () => Object.fromEntries((services.data || []).map((service) => [service.id, service.name])),
    [services.data],
  );
  const staffNames = useMemo(
    () => Object.fromEntries((staff.data?.staff || []).map((member) => [member.id, member.name])),
    [staff.data],
  );

  const allRows = useMemo<ReportRow[]>(() => [
    ...(requests.data || []).map<ReportRow>((request) => ({
      kind: "regular",
      eventId: request.eventId,
      serviceId: request.serviceId,
      capturedById: request.applicantUserId,
      capturedByName: staffNames[request.applicantUserId] || "No identificado",
      status: String(request.status),
      priority: Boolean(request.priorityOnReopening),
    })),
    ...(secretaryRequests.data?.requests || []).map<ReportRow>((request) => ({
      kind: "secretary",
      eventId: request.eventId,
      capturedById: request.capturedByUserId,
      capturedByName: request.capturedByName || staffNames[request.capturedByUserId] || "No identificado",
      // Una Atención de Secretaría nace como "recibida", que equivale al "enviada"
      // (Nueva) de un trámite; en los trámites "recibida" es un paso posterior.
      status: request.status === "recibida" ? "enviada" : String(request.status),
      priority: Boolean(request.highPriority),
    })),
  ], [requests.data, secretaryRequests.data?.requests, staffNames]);

  // Conteo por evento con ambos orígenes, para el selector.
  const reportEvents = useMemo<ReportEvent[]>(() => {
    const counts = new Map<string, number>();
    for (const row of allRows)
      if (row.eventId) counts.set(row.eventId, (counts.get(row.eventId) || 0) + 1);
    // Referencia: momento de la última carga (se vuelve a calcular al refrescar).
    return (events.data || []).map((event) => ({
      ...event,
      status: getEventStatus(event, events.dataUpdatedAt),
      requestCount: counts.get(event.id) || 0,
    }));
  }, [allRows, events.data, events.dataUpdatedAt]);

  const rows = useMemo(
    () => allRows.filter((row) => (!eventId || row.eventId === eventId) && (kind === "all" || row.kind === kind)),
    [allRows, eventId, kind],
  );

  const report = useMemo(() => {
    const capturedNames = Object.fromEntries(rows.map((row) => [row.capturedById, row.capturedByName]));
    const secretaryRows = rows.filter((row) => row.kind === "secretary");
    return {
      total: rows.length,
      regular: rows.length - secretaryRows.length,
      secretary: secretaryRows.length,
      priority: rows.filter((row) => row.priority).length,
      byStatus: splitBy(rows, (row) => row.status, statusText),
      byCapturista: splitBy(rows, (row) => row.capturedById, (key) => capturedNames[key] || "Capturista no identificado"),
      // Los asuntos de Secretaría son texto libre: solo los trámites del catálogo se agrupan aquí.
      byService: countBy(rows, (row) => row.serviceId, (key) => serviceNames[key] || "Trámite no disponible"),
    };
  }, [rows, serviceNames]);

  const queries = [requests, secretaryRequests, services, events, staff];

  return {
    events: reportEvents,
    selectedEvent: reportEvents.find((event) => event.id === eventId),
    report,
    isLoading: queries.some((query) => query.isLoading),
    isRefetching: queries.some((query) => query.isRefetching),
    error: requests.error || secretaryRequests.error || events.error,
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}

export type ReportData = ReturnType<typeof useReportes>["report"];
