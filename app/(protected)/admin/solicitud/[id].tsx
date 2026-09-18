"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import { useAuth } from "@/src/providers/AuthProvider";
import { adminService } from "@/src/services/admin";
import { identityApi } from "@/src/services/identityApi";
import { filesService } from "@/src/services/files";
import { requestsService } from "@/src/services/requests";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

const STATUS_LABELS: Record<string, string> = {
  enviada: "Nueva",
  recibida: "Recibida",
  en_revision: "En seguimiento",
  requiere_informacion: "Requiere información",
  aprobada: "Aprobada",
  rechazada: "No procedió",
  cancelada: "No continuó",
  concluida: "Concluida",
};
const STATUSES = ["recibida", "en_revision", "requiere_informacion", "aprobada", "rechazada", "cancelada", "concluida"];

const displayValue = (value: unknown) => {
  if (typeof value !== "string") return String(value ?? "—");
  try {
    const parsed = JSON.parse(value);
    return parsed?.name ? `Archivo: ${parsed.name}` : value;
  } catch { return value || "—"; }
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Superadministrador",
  secretaria: "Secretaria",
  enlace: "Enlace de canalización",
  gestor: "Gestor",
  capturista: "Capturista",
};

type AttachmentValue = {
  fileId?: string;
  name: string;
  type?: string;
  size?: number;
  url?: string;
};

const parseAttachment = (value: unknown): AttachmentValue | null => {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed?.name && (parsed?.url || parsed?.fileId) ? parsed : null;
  } catch {
    return null;
  }
};

function RequestValue({ value }: { value: unknown }) {
  const attachment = parseAttachment(value);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  if (!attachment) return <Text className="mt-1">{displayValue(value)}</Text>;
  const isImage = attachment.type?.startsWith("image/");
  const size = attachment.size
    ? `${(attachment.size / 1024 / 1024).toFixed(2)} MB`
    : null;
  return (
    <View className="mt-2 gap-3 rounded-xl border border-border bg-muted/40 p-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-semibold" numberOfLines={1}>{attachment.name}</Text>
          <Text className="mt-1 text-xs text-muted-foreground">
            {[attachment.type || "Archivo", size].filter(Boolean).join(" · ")}
          </Text>
        </View>
        {attachment.fileId ? (
          <Button
            size="sm"
            variant="outline"
            disabled={opening}
            onPress={async () => {
              setOpening(true);
              setOpenError(null);
              try {
                await filesService.openAuthenticatedFile(attachment.fileId!, attachment.type);
              } catch (cause) {
                setOpenError(cause instanceof Error ? cause.message : "No fue posible abrir el archivo");
              } finally {
                setOpening(false);
              }
            }}
          >
            <Text>{opening ? "Abriendo..." : isImage ? "Ver imagen" : "Abrir documento"}</Text>
          </Button>
        ) : (
          <Text className="text-xs text-destructive">Enlace no disponible</Text>
        )}
      </View>
      {openError ? <Text className="text-xs text-destructive">{openError}</Text> : null}
    </View>
  );
}

export default function RequestDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Array.isArray(id) ? id[0] : id;
  const { user, logout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [receivedBenefit, setReceivedBenefit] = useState<boolean | undefined>();
  const [benefitDetail, setBenefitDetail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const request = useQuery({
    queryKey: ["gestor", "request", requestId],
    queryFn: () => requestsService.getById(requestId!),
    enabled: Boolean(requestId && (user?.unidadAdministrativaId || user?.role === "secretaria" || user?.role === "enlace" || user?.role === "super_admin")),
  });
  const history = useQuery({
    queryKey: ["request-history", requestId],
    queryFn: () => requestsService.listHistory(requestId!),
    enabled: Boolean(requestId && (user?.role === "secretaria" || user?.role === "enlace" || user?.role === "gestor" || user?.role === "super_admin")),
  });
  const services = useQuery({ queryKey: ["gestor", "services"], queryFn: adminService.listServices });
  const globalForm = useQuery({ queryKey: ["admin", "global-form"], queryFn: adminService.getGlobalForm });
  const events = useQuery({ queryKey: ["gestor", "events"], queryFn: adminService.listEvents });
  const staff = useQuery({ queryKey: ["gestor", "reporting-staff"], queryFn: identityApi.getReportingStaff });
  const serviceNames = useMemo(() => Object.fromEntries((services.data || []).map((item) => [item.id, item.name])), [services.data]);
  const eventNames = useMemo(() => Object.fromEntries((events.data || []).map((item) => [item.id, item.name])), [events.data]);
  const staffNames = useMemo(() => Object.fromEntries((staff.data?.staff || []).map((item) => [item.id, item.name])), [staff.data]);
  const item = request.data;
  const selectedEvent = useMemo(
    () => (events.data || []).find((event) => event.id === item?.eventId),
    [events.data, item?.eventId],
  );
  const fieldLabels = useMemo(() => {
    const applicant = Object.fromEntries(
      (globalForm.data?.fields || []).map((field) => [field.key, field.label]),
    );
    const selectedService = (services.data || []).find(
      (service) => service.id === item?.serviceId,
    );
    const requestFields = Object.fromEntries(
      (selectedService?.formConfig?.fields || []).map((field) => [field.key, field.label]),
    );
    return { applicant, request: requestFields };
  }, [globalForm.data, services.data, item?.serviceId]);
  const selectedStatus = status || item?.status || "recibida";

  useEffect(() => {
    if (!item) return;
    setStatus(item.status);
    setComment(item.notes || "");
    setReason(item.discontinuationReason || "");
    setReceivedBenefit(item.receivedBenefit);
    setBenefitDetail(item.benefitDetail || "");
  }, [item]);

  const update = useMutation({
    mutationFn: () => identityApi.updateStatus(requestId!, selectedStatus, comment, {
      finalResult: STATUS_LABELS[selectedStatus],
      discontinuationReason: reason,
      receivedBenefit,
      benefitDetail,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gestor", "request", requestId] });
      await queryClient.invalidateQueries({ queryKey: ["gestor", "requests"] });
      setNotice("Seguimiento actualizado correctamente.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });
  const channel = useMutation({
    mutationFn: () => identityApi.requestReassignment(requestId!, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gestor", "request", requestId] });
      setNotice("Solicitud enviada a la mesa de canalización.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });

  if (user?.role !== "gestor" && user?.role !== "secretaria" && user?.role !== "enlace" && user?.role !== "super_admin") return <Redirect href="/admin" />;
  if (item && user?.role === "gestor" && item.unitId !== user.unidadAdministrativaId)
    return <Redirect href="/admin" />;

  return (
    <View className="h-screen flex-row bg-muted/30">
      <View className="w-72 border-r border-border bg-card p-5">
        <View className="mb-8 border-b border-border pb-5"><Text className="text-xl font-bold text-primary">Jornadas</Text><Text className="mt-1 text-xs text-muted-foreground">Expediente de solicitud</Text></View>
        <Pressable onPress={() => router.replace("/admin" as any)} className="rounded-xl bg-primary px-4 py-3"><Text className="font-semibold text-primary-foreground">← Bandeja de solicitudes</Text></Pressable>
        {user?.role !== "secretaria" ? <Pressable onPress={() => router.push("/home" as any)} className="mt-2 rounded-xl px-4 py-3 hover:bg-muted"><Text className="font-semibold">＋ Nueva captura</Text></Pressable> : null}
        <View className="mt-auto border-t border-border pt-5"><Text className="font-semibold">{user?.nombre}</Text><Text className="mb-4 mt-1 text-xs text-muted-foreground">Rol: {ROLE_LABELS[user?.role || ""] || "Usuario"}</Text><Button variant="outline" onPress={logout}><Text>Cerrar sesión</Text></Button></View>
      </View>
      <View className="flex-1 overflow-hidden">
        <View className="border-b border-border bg-background px-8 py-5"><Text className="text-2xl font-bold">Detalle de solicitud</Text><Text className="mt-1 text-sm text-muted-foreground">Expediente completo y seguimiento</Text></View>
        <ScrollView contentContainerStyle={{ padding: 32, gap: 20 }}>
          {request.isLoading ? <ActivityIndicator color="#981646" /> : null}
          {request.error ? <Text className="rounded-xl bg-destructive/10 p-4 text-destructive">No fue posible abrir esta solicitud o no pertenece a tu unidad.</Text> : null}
          {notice ? <Text className="rounded-xl bg-primary/10 p-4 text-primary">{notice}</Text> : null}
          {item ? <>
            <View className="rounded-2xl border border-border bg-card p-5">
              <View className="flex-row justify-between gap-4"><View><Text className="text-2xl font-bold">{item.folio}</Text><Text className="mt-1 text-muted-foreground">{new Date(item.requestedAt).toLocaleString("es-MX")}</Text></View><Text className="font-semibold text-primary">{STATUS_LABELS[item.status] || item.status}</Text></View>
              <View className="mt-5 grid grid-cols-3 gap-3">
                <View className="rounded-xl bg-muted/50 p-4"><Text className="text-xs font-bold text-muted-foreground">TRÁMITE</Text><Text className="mt-1 font-semibold">{serviceNames[item.serviceId] || "No disponible"}</Text></View>
                <View className="rounded-xl bg-muted/50 p-4">
                  <Text className="text-xs font-bold text-muted-foreground">EVENTO</Text>
                  <Text className="mt-1 font-semibold">{item.eventId ? eventNames[item.eventId] || item.eventFolio : "Fuera de evento"}</Text>
                  <Text className="mt-1 text-xs text-muted-foreground">Folio: {item.eventFolio || "Sin folio de evento"}</Text>
                  {selectedEvent ? (
                    <View className="mt-3 gap-1 border-t border-border pt-3">
                      <Text className="text-sm font-semibold">{selectedEvent.venue}</Text>
                      <Text className="text-xs">{selectedEvent.address}</Text>
                      <Text className="text-xs text-muted-foreground">
                        {selectedEvent.locality}, {selectedEvent.municipality}
                      </Text>
                    </View>
                  ) : item.eventId ? (
                    <Text className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Ubicación no disponible</Text>
                  ) : null}
                </View>
                <View className="rounded-xl bg-muted/50 p-4"><Text className="text-xs font-bold text-muted-foreground">CAPTURISTA</Text><Text className="mt-1 font-semibold">{staffNames[item.applicantUserId] || "No identificado"}</Text></View>
              </View>
              {item.status === "concluida" ? (
                <View className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <Text className="text-xs font-bold text-emerald-800">RESULTADO GUARDADO</Text>
                  <Text className="mt-1 font-semibold text-emerald-900">
                    {item.receivedBenefit === true
                      ? "Sí recibió el apoyo o beneficio"
                      : item.receivedBenefit === false
                        ? "Concluyó sin recibir apoyo o beneficio"
                        : "Pendiente de indicar si recibió el beneficio"}
                  </Text>
                  {item.benefitDetail ? <Text className="mt-1 text-sm text-emerald-800">{item.benefitDetail}</Text> : null}
                </View>
              ) : null}
            </View>
            <View className="grid grid-cols-2 gap-4">
              {[
                { title: "Información del solicitante", data: item.applicantData, labels: fieldLabels.applicant },
                { title: "Información del trámite", data: item.requestData, labels: fieldLabels.request },
              ].map((section) => <View key={section.title} className="rounded-2xl border border-border bg-card p-5"><Text className="mb-4 text-lg font-bold">{section.title}</Text>{Object.entries(section.data || {}).map(([key, value]) => <View key={key} className="mb-2 border-b border-border/50 pb-2"><Text className="text-xs font-bold uppercase text-muted-foreground">{section.labels[key] || key.replace(/^pregunta_?/, "Pregunta ").replaceAll("_", " ")}</Text><RequestValue value={value} /></View>)}</View>)}
            </View>
            <View className="rounded-2xl border border-border bg-card p-5">
              <Text className="text-xl font-bold">Historial de estatus</Text>
              <Text className="mb-4 mt-1 text-sm text-muted-foreground">Registro cronológico de movimientos y responsables.</Text>
              {history.isLoading ? <ActivityIndicator color="#981646" /> : null}
              <View className="gap-3">
                {(history.data || []).map((entry) => (
                  <View key={entry.id} className="flex-row gap-4 rounded-xl bg-muted/50 p-4">
                    <View className="mt-1 h-3 w-3 rounded-full bg-primary" />
                    <View className="flex-1">
                      <Text className="font-semibold">{entry.previousStatus ? `${STATUS_LABELS[entry.previousStatus] || entry.previousStatus} → ` : ""}{STATUS_LABELS[entry.newStatus] || entry.newStatus}</Text>
                      <Text className="mt-1 text-sm text-muted-foreground">{new Date(entry.date).toLocaleString("es-MX")} · {staffNames[entry.performedByUserId] || "Usuario del sistema"}</Text>
                      {entry.comment ? <Text className="mt-2">{entry.comment}</Text> : null}
                    </View>
                  </View>
                ))}
                {!history.isLoading && !history.data?.length ? <Text className="text-muted-foreground">No hay movimientos registrados.</Text> : null}
              </View>
            </View>
            {user?.role === "gestor" || user?.role === "super_admin" ? <View className="gap-4 rounded-2xl border border-border bg-card p-5">
              <Text className="text-xl font-bold">Actualizar seguimiento</Text>
              <View className="gap-2"><Text className="font-semibold">Nuevo estatus</Text><select value={selectedStatus} onChange={(event) => setStatus(event.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2">{STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></View>
              <View className="gap-2"><Text className="font-semibold">Comentario de atención</Text><Input value={comment} onChangeText={setComment} placeholder="Describe el seguimiento realizado" /></View>
              {(selectedStatus === "rechazada" || selectedStatus === "cancelada") ? <View className="gap-2"><Text className="font-semibold">Motivo por el que no continuó</Text><Input value={reason} onChangeText={setReason} placeholder="Motivo obligatorio" /></View> : null}
              {selectedStatus === "concluida" ? <View className="gap-3 rounded-xl bg-muted/50 p-4"><Text className="font-semibold">¿Recibió el apoyo o beneficio?</Text><View className="flex-row gap-2">{[true, false].map((value) => <Pressable key={String(value)} onPress={() => setReceivedBenefit(value)} className={`rounded-lg border px-4 py-2 ${receivedBenefit === value ? "border-primary bg-primary/10" : "border-border"}`}><Text>{value ? "Sí" : "No"}</Text></Pressable>)}</View><Input value={benefitDetail} onChangeText={setBenefitDetail} placeholder="Detalle del resultado" /></View> : null}
              <View className="items-end"><Button disabled={update.isPending || ((selectedStatus === "rechazada" || selectedStatus === "cancelada") && !reason.trim()) || (selectedStatus === "concluida" && typeof receivedBenefit !== "boolean")} onPress={() => update.mutate()}><Text>{update.isPending ? "Guardando..." : "Guardar seguimiento"}</Text></Button></View>
            </View> : null}
            {user?.role === "gestor" ? (!item.reassignmentRequired ? <View className="gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5"><Text className="text-lg font-bold text-amber-900">El trámite no corresponde a esta unidad</Text><Text className="text-sm text-amber-800">Indica el motivo para enviarlo al Enlace.</Text><Input value={reason} onChangeText={setReason} placeholder="Motivo de no aplicación" /><View className="items-start"><Button variant="outline" disabled={!reason.trim() || channel.isPending} onPress={() => channel.mutate()}><Text>Solicitar canalización</Text></Button></View></View> : <Text className="rounded-xl bg-amber-100 p-4 font-semibold text-amber-900">Pendiente de canalización por el Enlace.</Text>) : null}
          </> : null}
        </ScrollView>
      </View>
    </View>
  );
}
