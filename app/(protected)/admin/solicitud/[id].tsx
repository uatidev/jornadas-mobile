"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import { useAuth } from "@/src/providers/AuthProvider";
import { adminService } from "@/src/services/admin";
import { filesService } from "@/src/services/files";
import { identityApi } from "@/src/services/identityApi";
import { requestsService } from "@/src/services/requests";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

const STATUS_LABELS: Record<string, string> = {
  enviada: "Nueva",
  en_espera_apertura: "En espera de apertura",
  recibida: "Recibida",
  en_revision: "En seguimiento",
  requiere_informacion: "Requiere información",
  aprobada: "Aprobada",
  rechazada: "No procedió",
  cancelada: "No continuó",
  concluida: "Concluida",
};
const STATUSES = ["recibida", "en_revision", "requiere_informacion", "aprobada", "rechazada", "cancelada", "concluida"];
const REJECTION_REASONS = ["Falta de presupuesto", "Cupo agotado", "No cumple los requisitos", "Documentación inválida", "Fuera de cobertura", "Programa cerrado", "Solicitud duplicada", "Otro"];
const CANCELLATION_REASONS = ["La persona desistió", "No entregó la información solicitada", "No fue posible localizarla", "Venció el plazo", "Recibió atención por otra vía", "Otro"];

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
  const [otherReason, setOtherReason] = useState("");
  const [reassignmentReason, setReassignmentReason] = useState("");
  const [receivedBenefit, setReceivedBenefit] = useState<boolean | undefined>();
  const [benefitDetail, setBenefitDetail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [receiptEmail, setReceiptEmail] = useState("");
  const [editingData, setEditingData] = useState(false);
  const [applicantDraft, setApplicantDraft] = useState<Record<string, unknown>>({});
  const [requestDraft, setRequestDraft] = useState<Record<string, unknown>>({});
  const [correctionReason, setCorrectionReason] = useState("");
  const [destinationUnitId, setDestinationUnitId] = useState("");
  const [destinationMode, setDestinationMode] = useState<"unit" | "service">("unit");
  const [destinationServiceId, setDestinationServiceId] = useState("");
  const [canalizationNote, setCanalizationNote] = useState("");
  const [currentTime] = useState(() => Date.now());

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
  const units = useQuery({ queryKey: ["enlace", "units"], queryFn: adminService.listUnits, enabled: user?.role === "enlace" || user?.role === "gestor" });
  const globalForm = useQuery({ queryKey: ["admin", "global-form"], queryFn: adminService.getGlobalForm });
  const events = useQuery({ queryKey: ["gestor", "events"], queryFn: adminService.listEvents });
  const staff = useQuery({ queryKey: ["gestor", "reporting-staff"], queryFn: identityApi.getReportingStaff });
  const serviceNames = useMemo(() => Object.fromEntries((services.data || []).map((item) => [item.id, item.name])), [services.data]);
  const eventNames = useMemo(() => Object.fromEntries((events.data || []).map((item) => [item.id, item.name])), [events.data]);
  const staffNames = useMemo(() => Object.fromEntries((staff.data?.staff || []).map((item) => [item.id, item.name])), [staff.data]);
  const item = request.data;
  const assignedUnit = (units.data || []).find((unit) => unit.id === user?.unidadAdministrativaId);
  const selectedService = (services.data || []).find((service) => service.id === item?.serviceId);
  const serviceIsClosed = Boolean(selectedService && (
    !selectedService.active ||
    (selectedService.opensAt && currentTime < new Date(selectedService.opensAt).getTime()) ||
    (selectedService.closesAt && currentTime > new Date(selectedService.closesAt).getTime())
  ));
  const isWaitingForOpening = item?.status === "en_espera_apertura" || (item?.status === "enviada" && serviceIsClosed);
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
    return {
      applicant,
      request: requestFields,
      applicantTypes: Object.fromEntries((globalForm.data?.fields || []).map((field) => [field.key, field.type])),
      requestTypes: Object.fromEntries((selectedService?.formConfig?.fields || []).map((field) => [field.key, field.type])),
    };
  }, [globalForm.data, services.data, item?.serviceId]);
  const selectedStatus = status || item?.status || "recibida";
  const outcomeReason = reason === "Otro" ? otherReason.trim() : reason.trim();
  const outcomeReasons = selectedStatus === "rechazada" ? REJECTION_REASONS : CANCELLATION_REASONS;
  const changeStatus = (nextStatus: string) => {
    if (nextStatus !== selectedStatus && (nextStatus === "rechazada" || nextStatus === "cancelada")) {
      setReason("");
      setOtherReason("");
    }
    setStatus(nextStatus);
  };

  useEffect(() => {
    if (!item) return;
    setStatus(item.status);
    setComment(item.notes || "");
    setReason(item.discontinuationReason || "");
    setReceivedBenefit(item.receivedBenefit);
    setBenefitDetail(item.benefitDetail || "");
    if (!editingData) {
      setApplicantDraft(item.applicantData || {});
      setRequestDraft(item.requestData || {});
    }
  }, [item, editingData]);

  useEffect(() => {
    if (!item?.applicantData || receiptEmail) return;
    const emailEntry = Object.entries(item.applicantData).find(([key]) =>
      /correo|email/i.test(key),
    );
    if (typeof emailEntry?.[1] === "string") setReceiptEmail(emailEntry[1]);
  }, [item?.applicantData, receiptEmail]);

  const update = useMutation({
    mutationFn: () => identityApi.updateStatus(requestId!, selectedStatus, comment, {
      finalResult: STATUS_LABELS[selectedStatus],
      discontinuationReason: outcomeReason,
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
    mutationFn: () => identityApi.requestReassignment(requestId!, reassignmentReason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gestor", "request", requestId] });
      setReassignmentReason("");
      setNotice("Solicitud enviada a la mesa de canalización.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });
  const resendReceipt = useMutation({
    mutationFn: () => identityApi.resendRequestReceipt(requestId!, receiptEmail.trim()),
    onSuccess: (result) => setNotice(result.message),
    onError: (cause: Error) => setNotice(cause.message),
  });
  const reassign = useMutation({
    mutationFn: () => identityApi.reassignRequest(requestId!, destinationUnitId, canalizationNote),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gestor", "request", requestId] });
      await queryClient.invalidateQueries({ queryKey: ["enlace", "reassignment-queue"] });
      setNotice("Solicitud canalizada correctamente.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });
  const correctData = useMutation({
    mutationFn: () => identityApi.adminUpdateRequestData(requestId!, applicantDraft, requestDraft, correctionReason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gestor", "request", requestId] });
      await queryClient.invalidateQueries({ queryKey: ["request-history", requestId] });
      setEditingData(false);
      setCorrectionReason("");
      setNotice("Datos de la solicitud corregidos correctamente.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });

  if (user?.role !== "gestor" && user?.role !== "secretaria" && user?.role !== "enlace" && user?.role !== "super_admin") return <Redirect href="/admin" />;
  if (item && user?.role === "gestor" && item.unitId !== user.unidadAdministrativaId)
    return <Redirect href="/admin" />;

  return (
    <View className="h-screen flex-row bg-muted/30">
      {user?.role !== "enlace" ? <View className="w-72 border-r border-border bg-card p-5">
        <View className="mb-8 border-b border-border pb-5"><Text className="text-xl font-bold text-primary">Jornadas</Text><Text className="mt-1 text-xs text-muted-foreground">Expediente de solicitud</Text>
          {/* {user?.role === "gestor" && user.unidadAdministrativaId ?  */}
          {/* <View className="mt-4 rounded-xl border border-primary/25 bg-primary/10 p-3"> */}
          {/* <Text className="text-[10px] font-bold uppercase tracking-wider text-primary">Unidad asignada</Text> */}
          {/* <Text className="mt-1 font-semibold">{units.isLoading ? "Cargando..." : assignedUnit?.name || "Unidad no disponible"}</Text> */}
          {/* </View> : null} */}
        </View>
        <Pressable onPress={() => router.replace("/admin" as any)} className="rounded-xl bg-primary px-4 py-3"><Text className="font-semibold text-primary-foreground">← Bandeja de solicitudes</Text></Pressable>
        {user?.role !== "secretaria" ? <Pressable onPress={() => router.push("/home" as any)} className="mt-2 rounded-xl px-4 py-3 hover:bg-muted"><Text className="font-semibold">＋ Nueva captura</Text></Pressable> : null}
        <View className="mt-auto border-t border-border pt-5"><Text className="font-semibold">{user?.nombre}</Text><Text className="mb-4 mt-1 text-xs text-muted-foreground">Rol: {ROLE_LABELS[user?.role || ""] || "Usuario"}</Text><Button variant="outline" onPress={logout}><Text>Cerrar sesión</Text></Button></View>
      </View> : null
      }
      <View className="flex-1 overflow-hidden">
        <View className="border-b border-border bg-background px-8 py-5"><Text className="text-2xl font-bold">Detalle de solicitud</Text><Text className="mt-1 text-sm text-muted-foreground">Expediente completo y seguimiento</Text></View>
        <ScrollView contentContainerStyle={{ padding: 32, gap: 20 }}>
          {request.isLoading ? <ActivityIndicator color="#981646" /> : null}
          {request.error ? <Text className="rounded-xl bg-destructive/10 p-4 text-destructive">No fue posible abrir esta solicitud o no pertenece a tu unidad.</Text> : null}
          {notice ? <Text className="rounded-xl bg-primary/10 p-4 text-primary">{notice}</Text> : null}
          {item ? <View className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5 max-lg:grid-cols-1">
            <View className="min-w-0 gap-5">
              <View className="rounded-2xl border border-border bg-card p-5">
              <View className="flex-row justify-between gap-4"><View><Text className="text-2xl font-bold">{item.folio}</Text><Text className="mt-1 text-muted-foreground">{new Date(item.requestedAt).toLocaleString("es-MX")}</Text></View><Text className="font-semibold text-primary">{isWaitingForOpening ? "En espera de apertura" : STATUS_LABELS[item.status] || item.status}</Text></View>
                <View className="mt-5 grid grid-cols-3 gap-x-8 gap-y-4 border-t border-border pt-4 max-lg:grid-cols-1">
                  <View><Text className="text-xs font-bold text-muted-foreground">TRÁMITE</Text><Text className="mt-1 font-semibold">{serviceNames[item.serviceId] || "No disponible"}</Text></View>
                  <View>
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
                  <View><Text className="text-xs font-bold text-muted-foreground">CAPTURISTA</Text><Text className="mt-1 font-semibold">{staffNames[item.applicantUserId] || "No identificado"}</Text></View>
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
              {user?.role === "super_admin" ? (
                <View className="gap-4 rounded-2xl border border-border bg-card p-5">
                  <View className="flex-row items-center justify-between gap-4">
                    <View><Text className="text-xl font-bold">Corrección administrativa</Text><Text className="mt-1 text-sm text-muted-foreground">El folio, evento, unidad, estatus y archivos permanecen protegidos.</Text></View>
                    <Button variant="outline" onPress={() => setEditingData((value) => !value)}><Text>{editingData ? "Cancelar" : "Editar datos"}</Text></Button>
                  </View>
                  {editingData ? <>
                    {([{ title: "Datos del solicitante", draft: applicantDraft, setDraft: setApplicantDraft, labels: fieldLabels.applicant, types: fieldLabels.applicantTypes }, { title: "Datos del trámite", draft: requestDraft, setDraft: setRequestDraft, labels: fieldLabels.request, types: fieldLabels.requestTypes }] as const).map((section) => (
                      <View key={section.title} className="gap-3 rounded-xl bg-muted/40 p-4">
                        <Text className="font-bold">{section.title}</Text>
                        {Array.from(new Set([...Object.keys(section.labels), ...Object.keys(section.draft)])).map((key) => {
                          const value = section.draft[key];
                          const label = section.labels[key] || key.replace(/^pregunta_?/, "Pregunta ").replaceAll("_", " ");
                          return section.types[key] === "file" || parseAttachment(value) ? <View key={key}><Text className="text-xs font-bold uppercase text-muted-foreground">{label}</Text><Text className="mt-1 text-sm">{value ? "Archivo protegido" : "Sin archivo"}</Text></View> : <View key={key} className="gap-1"><Text className="text-xs font-bold uppercase text-muted-foreground">{label}</Text><Input value={String(value ?? "")} onChangeText={(next) => section.setDraft((current) => ({ ...current, [key]: next }))} placeholder="Sin respuesta" /></View>;
                        })}
                      </View>
                    ))}
                    <View className="gap-2"><Text className="font-semibold">Motivo de la corrección *</Text><Input value={correctionReason} onChangeText={setCorrectionReason} placeholder="Describe qué dato se corrigió y por qué" /></View>
                    <View className="items-start"><Button disabled={correctData.isPending || correctionReason.trim().length < 5} onPress={() => correctData.mutate()}><Text>{correctData.isPending ? "Guardando..." : "Guardar corrección"}</Text></Button></View>
                  </> : null}
                </View>
              ) : null}
              {user?.role === "super_admin" ? (
                <View className="gap-4 rounded-2xl border border-border bg-card p-5">
                  <View>
                    <Text className="text-xl font-bold">Reenviar comprobante</Text>
                    <Text className="mt-1 text-sm text-muted-foreground">
                      Envía nuevamente el comprobante de registro de esta solicitud.
                    </Text>
                  </View>
                  <View className="max-w-xl gap-2">
                    <Text className="font-semibold">Correo del destinatario</Text>
                    <Input
                      value={receiptEmail}
                      onChangeText={setReceiptEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="persona@correo.com"
                    />
                  </View>
                  <View className="items-start">
                    <Button
                      disabled={resendReceipt.isPending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail.trim())}
                      onPress={() => resendReceipt.mutate()}
                    >
                      <Text>{resendReceipt.isPending ? "Enviando..." : "Reenviar comprobante"}</Text>
                    </Button>
                  </View>
                </View>
              ) : null}
              {false && user?.role === "enlace" && item?.reassignmentRequired ? (
                <View className="sticky top-5 !col-start-2 !row-start-1 gap-4 rounded-2xl border border-primary/30 bg-card p-5 max-lg:static max-lg:!col-start-1">
                  <View><Text className="text-xl font-bold">Canalizar solicitud</Text><Text className="mt-1 text-sm text-muted-foreground">Después de revisar el expediente, selecciona la unidad administrativa competente.</Text></View>
                  <View className="gap-2"><Text className="font-semibold">Unidad responsable *</Text><select value={destinationUnitId} onChange={(event) => setDestinationUnitId(event.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Selecciona una unidad</option>{(units.data || []).filter((unit) => unit.active && unit.id !== item?.unitId).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></View>
                  <View className="gap-2"><Text className="font-semibold">Nota de canalización</Text><Input value={canalizationNote} onChangeText={setCanalizationNote} placeholder="Explica brevemente el criterio de asignación" multiline className="min-h-24" /></View>
                  <View className="items-start"><Button disabled={!destinationUnitId || reassign.isPending} onPress={() => reassign.mutate()}><Text>{reassign.isPending ? "Canalizando..." : "Confirmar canalización"}</Text></Button></View>
                </View>
              ) : null}
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
              {user?.role === "super_admin" ? <View className="gap-4 rounded-2xl border border-border bg-card p-5">
                <Text className="text-xl font-bold">Actualizar seguimiento</Text>
                <View className="gap-2"><Text className="font-semibold">Nuevo estatus</Text><select value={selectedStatus} onChange={(event) => changeStatus(event.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2">{selectedStatus === "en_espera_apertura" ? <option value="en_espera_apertura" disabled>En espera de apertura</option> : null}{STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></View>
                <View className="gap-2"><Text className="font-semibold">Comentario de atención</Text><Input value={comment} onChangeText={setComment} placeholder="Describe el seguimiento realizado" /></View>
                {(selectedStatus === "rechazada" || selectedStatus === "cancelada") ? <View className="gap-2"><Text className="font-semibold">{selectedStatus === "rechazada" ? "Motivo por el que no procedió" : "Motivo por el que no continuó"}</Text><select value={reason} onChange={(event) => { setReason(event.currentTarget.value); if (event.currentTarget.value !== "Otro") setOtherReason(""); }} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Selecciona un motivo</option>{outcomeReasons.map((value) => <option key={value} value={value}>{value}</option>)}</select>{reason === "Otro" ? <Input value={otherReason} onChangeText={setOtherReason} placeholder="Especifica el motivo" multiline className="min-h-20" /> : null}</View> : null}
                {selectedStatus === "concluida" ? <View className="gap-3 rounded-xl bg-muted/50 p-4"><Text className="font-semibold">¿Recibió el apoyo o beneficio?</Text><View className="flex-row gap-2">{[true, false].map((value) => <Pressable key={String(value)} onPress={() => setReceivedBenefit(value)} className={`rounded-lg border px-4 py-2 ${receivedBenefit === value ? "border-primary bg-primary/10" : "border-border"}`}><Text>{value ? "Sí" : "No"}</Text></Pressable>)}</View><Input value={benefitDetail} onChangeText={setBenefitDetail} placeholder="Detalle del resultado" /></View> : null}
                <View className="items-end"><Button disabled={update.isPending || ((selectedStatus === "rechazada" || selectedStatus === "cancelada") && !outcomeReason) || (selectedStatus === "concluida" && typeof receivedBenefit !== "boolean")} onPress={() => update.mutate()}><Text>{update.isPending ? "Guardando..." : "Guardar seguimiento"}</Text></Button></View>
              </View> : null}
            </View>
            {user?.role === "gestor" ? <View className="sticky top-5 gap-5 max-lg:static">
              <View className="gap-4 rounded-2xl border border-primary/30 bg-card p-5">
                <View><Text className="text-xl font-bold">Acciones</Text><Text className="mt-1 text-sm text-muted-foreground">Actualiza el seguimiento de esta solicitud.</Text></View>
                <View className="gap-2"><Text className="font-semibold">Nuevo estatus</Text><select value={selectedStatus} onChange={(event) => changeStatus(event.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2">{isWaitingForOpening && (selectedStatus === "enviada" || selectedStatus === "en_espera_apertura") ? <option value={selectedStatus} disabled>En espera de apertura</option> : null}{STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></View>
                <View className="gap-2"><Text className="font-semibold">Comentario de atención</Text><Input value={comment} onChangeText={setComment} placeholder="Describe el seguimiento realizado" multiline className="min-h-24" /></View>
                {(selectedStatus === "rechazada" || selectedStatus === "cancelada") ? <View className="gap-2"><Text className="font-semibold">{selectedStatus === "rechazada" ? "Motivo por el que no procedió" : "Motivo por el que no continuó"}</Text><select value={reason} onChange={(event) => { setReason(event.currentTarget.value); if (event.currentTarget.value !== "Otro") setOtherReason(""); }} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Selecciona un motivo</option>{outcomeReasons.map((value) => <option key={value} value={value}>{value}</option>)}</select>{reason === "Otro" ? <Input value={otherReason} onChangeText={setOtherReason} placeholder="Especifica el motivo" multiline className="min-h-20" /> : null}</View> : null}
                {selectedStatus === "concluida" ? <View className="gap-3 rounded-xl bg-muted/50 p-4"><Text className="font-semibold">¿Recibió el apoyo o beneficio?</Text><View className="flex-row gap-2">{[true, false].map((value) => <Pressable key={String(value)} onPress={() => setReceivedBenefit(value)} className={`rounded-lg border px-4 py-2 ${receivedBenefit === value ? "border-primary bg-primary/10" : "border-border"}`}><Text>{value ? "Sí" : "No"}</Text></Pressable>)}</View><Input value={benefitDetail} onChangeText={setBenefitDetail} placeholder="Detalle del resultado" /></View> : null}
                <Button disabled={update.isPending || ((selectedStatus === "rechazada" || selectedStatus === "cancelada") && !outcomeReason) || (selectedStatus === "concluida" && typeof receivedBenefit !== "boolean")} onPress={() => update.mutate()}><Text>{update.isPending ? "Guardando..." : "Guardar seguimiento"}</Text></Button>
              </View>
              {!item.reassignmentRequired ? <View className="gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5"><Text className="text-lg font-bold text-amber-900">¿El trámite no corresponde?</Text><Text className="text-sm text-amber-800">Indica únicamente por qué esta solicitud debe enviarse al Enlace de canalización.</Text><Input value={reassignmentReason} onChangeText={setReassignmentReason} placeholder="Motivo para solicitar la canalización" multiline className="min-h-20" /><Button variant="outline" disabled={!reassignmentReason.trim() || channel.isPending} onPress={() => channel.mutate()}><Text>{channel.isPending ? "Enviando..." : "Solicitar canalización"}</Text></Button></View> : <Text className="rounded-xl bg-amber-100 p-4 font-semibold text-amber-900">Pendiente de canalización por el Enlace.</Text>}
            </View> : user?.role === "enlace" && item.reassignmentRequired ? (
              <View className="sticky top-5 gap-4 rounded-2xl border border-primary/30 bg-card p-5 max-lg:static">
                <View><Text className="text-xl font-bold">Acciones</Text><Text className="mt-1 text-sm text-muted-foreground">Después de revisar el expediente, selecciona la unidad administrativa competente.</Text></View>
                <View className="gap-2"><Text className="font-semibold">Canalizar por *</Text><select value={destinationMode} onChange={(event) => { setDestinationMode(event.currentTarget.value as "unit" | "service"); setDestinationServiceId(""); setDestinationUnitId(""); }} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="unit">Unidad administrativa</option><option value="service">Trámite / servicio / programa</option></select></View>
                {destinationMode === "unit" ? <View className="gap-2"><Text className="font-semibold">Unidad responsable *</Text><select value={destinationUnitId} onChange={(event) => setDestinationUnitId(event.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Selecciona una unidad</option>{(units.data || []).filter((unit) => unit.active && unit.id !== item.unitId).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></View> : <View className="gap-2"><Text className="font-semibold">Trámite, servicio o programa *</Text><select value={destinationServiceId} onChange={(event) => { const serviceId = event.currentTarget.value; setDestinationServiceId(serviceId); setDestinationUnitId((services.data || []).find((service) => service.id === serviceId)?.unitId || ""); }} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Selecciona una opción</option>{(services.data || []).filter((service) => service.active && service.unitId !== item.unitId).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>{destinationUnitId ? <Text className="text-xs text-muted-foreground">Unidad responsable: {(units.data || []).find((unit) => unit.id === destinationUnitId)?.name || "No disponible"}</Text> : null}</View>}
                <View className="gap-2"><Text className="font-semibold">Nota de canalización</Text><Input value={canalizationNote} onChangeText={setCanalizationNote} placeholder="Explica brevemente el criterio de asignación" multiline className="min-h-24" /></View>
                <Button disabled={!destinationUnitId || reassign.isPending} onPress={() => reassign.mutate()}><Text>{reassign.isPending ? "Canalizando..." : "Confirmar canalización"}</Text></Button>
              </View>
            ) : user?.role === "enlace" ? <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Acciones</Text><Text className="mt-2 text-sm text-muted-foreground">Esta solicitud ya no tiene acciones de canalización pendientes.</Text></View> : null}
          </View> : null}
        </ScrollView>
      </View>
    </View >
  );
}
