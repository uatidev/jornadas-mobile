import { useAuth } from "@/src/providers/AuthProvider";
import { identityApi } from "@/src/services/identityApi";
import { requestsService } from "@/src/services/requests";
import type { SecretaryRequest, ServiceRequest } from "@/src/types/request";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useGlobalForm, useServicesCatalog } from "./useCatalog";

export type MyRequestKind = "regular" | "secretary";

/** Solicitud capturada por el usuario (trámite regular o de Secretaría) en un formato común. */
export type MyRequestItem = {
  key: string;
  kind: MyRequestKind;
  id: string;
  folio: string;
  title: string;
  applicantName?: string;
  status: string;
  statusLabel: string;
  date: string;
  priority: boolean;
  eventId?: string;
  regular?: ServiceRequest;
  secretary?: SecretaryRequest;
};

export const STATUS_LABELS: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  en_espera_apertura: "En espera de apertura",
  recibida: "Recibida",
  en_revision: "En revisión",
  requiere_informacion: "Requiere información",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
  concluida: "Concluida",
  en_atencion: "En atención",
  pendiente_canalizacion: "Pendiente de canalización",
  canalizada: "Canalizada",
  atendida: "Atendida",
};

export const statusLabel = (status: string) =>
  STATUS_LABELS[status] ?? status.replaceAll("_", " ");

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const NAME_PATTERN = /^(nombre|nombres|apellido)/;

export const canSeeSecretaryRequests = (role?: string) =>
  role === "secretaria" ||
  role === "capturista_secretaria" ||
  role === "enlace" ||
  role === "gestor" ||
  role === "super_admin";

/** Trámites regulares y solicitudes de Secretaría capturadas por el usuario. */
export function useMyRequests() {
  const { user } = useAuth();
  const services = useServicesCatalog();
  const globalForm = useGlobalForm();
  const withSecretary = canSeeSecretaryRequests(user?.role);

  const requests = useQuery({
    queryKey: ["my-captured-requests", user?.id],
    queryFn: () => requestsService.listByCapturista(user!.id),
    enabled: Boolean(user?.id),
  });
  const secretaryRequests = useQuery({
    queryKey: ["my-secretary-requests", user?.id],
    queryFn: async () => {
      try {
        return await identityApi.listMySecretaryRequests();
      } catch {
        const legacy = await identityApi.listSecretaryRequests();
        return {
          requests: legacy.requests.filter(
            (request) => request.capturedByUserId === user?.id,
          ),
        };
      }
    },
    enabled: Boolean(user?.id) && withSecretary,
    staleTime: 30_000,
  });

  const serviceNames = useMemo(
    () => Object.fromEntries((services.data || []).map((service) => [service.id, service.name])),
    [services.data],
  );
  const globalFieldLabels = useMemo(
    () => Object.fromEntries((globalForm.data?.fields || []).map((field) => [field.key, field.label])),
    [globalForm.data?.fields],
  );
  const serviceFieldLabels = useMemo(
    () => Object.fromEntries((services.data || []).map((service) => [
      service.id,
      Object.fromEntries((service.formConfig?.fields || []).map((field) => [field.key, field.label])),
    ])),
    [services.data],
  );

  // Campos de nombre y apellidos del formulario global, en su orden.
  const nameKeys = useMemo(
    () => (globalForm.data?.fields || [])
      .filter((field) => NAME_PATTERN.test(normalize(field.key)) || NAME_PATTERN.test(normalize(field.label)))
      .map((field) => field.key),
    [globalForm.data?.fields],
  );

  const items = useMemo<MyRequestItem[]>(() => {
    const applicantName = (data?: Record<string, unknown>) => {
      if (!data) return undefined;
      const keys = nameKeys.length
        ? nameKeys
        : Object.keys(data).filter((key) => NAME_PATTERN.test(normalize(key)));
      const name = keys
        .map((key) => data[key])
        .filter((value) => typeof value === "string" && value.trim())
        .join(" ")
        .trim();
      return name || undefined;
    };

    const regular = (requests.data || []).map<MyRequestItem>((request) => ({
      key: `regular-${request.id}`,
      kind: "regular",
      id: request.id,
      folio: request.folio,
      title: serviceNames[request.serviceId] || "Trámite no disponible",
      applicantName: applicantName(request.applicantData),
      status: request.status,
      statusLabel: statusLabel(request.status),
      date: request.requestedAt,
      priority: Boolean(request.priorityOnReopening),
      eventId: request.eventId,
      regular: request,
    }));
    const secretary = withSecretary
      ? (secretaryRequests.data?.requests || []).map<MyRequestItem>((request) => ({
          key: `secretary-${request.id}`,
          kind: "secretary",
          id: request.id,
          folio: request.folio,
          title: request.subject,
          applicantName: applicantName(request.applicantData),
          status: request.status,
          statusLabel: statusLabel(request.status),
          date: request.createdAt,
          priority: request.highPriority,
          eventId: request.eventId,
          secretary: request,
        }))
      : [];

    return [...regular, ...secretary].sort(
      (first, second) => new Date(second.date).getTime() - new Date(first.date).getTime(),
    );
  }, [requests.data, secretaryRequests.data?.requests, withSecretary, serviceNames, nameKeys]);

  return {
    items,
    withSecretary,
    globalFieldLabels,
    serviceFieldLabels,
    isLoading:
      services.isLoading ||
      globalForm.isLoading ||
      requests.isLoading ||
      (withSecretary && secretaryRequests.isLoading),
    isRefetching: requests.isRefetching || secretaryRequests.isRefetching,
    error: requests.error || (withSecretary ? secretaryRequests.error : null),
    refetch: () =>
      Promise.all([
        requests.refetch(),
        services.refetch(),
        globalForm.refetch(),
        ...(withSecretary ? [secretaryRequests.refetch()] : []),
      ]),
  };
}
