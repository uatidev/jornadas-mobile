import { CollapsingHeaderScrollView } from "@/src/components/common/CollapsingHeader";
import { GlassIconButton } from "@/src/components/common/GlassIconButton";
import { GlassInput } from "@/src/components/common/GlassInput";
import { GlassSelect } from "@/src/components/common/GlassSelect";
import { DynamicGlobalForm, INEAutoFill, isDynamicFormComplete } from "@/src/components/modules/new-request";
import { Button } from "@/src/components/ui/button";
import { Text } from "@/src/components/ui/text";
import { useActiveEvents, useGlobalForm } from "@/src/hooks/useCatalog";
import { useSelectedEventId } from "@/src/hooks/useSelectedEvent";
import { useAuth } from "@/src/providers/AuthProvider";
import { adminService } from "@/src/services/admin";
import { filesService } from "@/src/services/files";
import { identityApi } from "@/src/services/identityApi";
import type { SecretaryRequest, SecretaryRequestDocument, SecretaryRequestStatus } from "@/src/types/request";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STATUS_LABELS: Record<string, string> = {
  recibida: "Recibida",
  en_atencion: "En atención",
  requiere_informacion: "Requiere información",
  pendiente_canalizacion: "Pendiente de canalización",
  canalizada: "Canalizada",
  atendida: "Atendida",
  cancelada: "Cancelada",
};

const SOURCE_LABELS = {
  gobernador: "Gobernador",
  oficina_gubernamental: "Oficina gubernamental",
  otra: "Otra procedencia",
};

function RequestCard({ item, canClose }: { item: SecretaryRequest; canClose: boolean }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [unitId, setUnitId] = useState("");
  const [comment, setComment] = useState("");
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const units = useQuery({ queryKey: ["secretary-requests", "units"], queryFn: adminService.listUnits, enabled: user?.role === "enlace" && item.status === "pendiente_canalizacion" });
  const update = useMutation({
    mutationFn: (data: { status?: SecretaryRequestStatus; unitId?: string; comment?: string }) => identityApi.updateSecretaryRequest(item.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["secretary-requests"] }),
  });
  const canWork = user?.role === "secretaria" || user?.role === "capturista_secretaria" || user?.role === "gestor" || user?.role === "super_admin";

  return <View className="gap-4 rounded-2xl border border-border bg-card p-5">
    <View className={`${compact ? "gap-3" : "flex-row items-start justify-between gap-3"}`}>
      <View className="flex-1"><Text className="text-lg font-bold">{item.folio}</Text><Text className="mt-1 font-semibold">{item.subject}</Text></View>
      <View className="self-start rounded-full bg-amber-100 px-3 py-1"><Text className="text-xs font-bold text-amber-800">PRIORIDAD ALTA</Text></View>
    </View>
    <Text className="text-sm text-muted-foreground">{SOURCE_LABELS[item.source]} · {STATUS_LABELS[item.status]}</Text>
    <Text className="text-sm">Capturó: {item.capturedByName}{item.capturedOnBehalfOfSecretary ? " · En nombre de Secretaría" : ""}</Text>
    {item.officeNumber ? <Text className="text-sm">Oficio: {item.officeNumber}</Text> : null}
    {item.eventFolio ? <Text className="text-sm">Evento: {item.eventFolio}</Text> : null}
    {Object.entries(item.applicantData).map(([key, value]) => value ? <Text key={key} className="text-sm text-muted-foreground">{key}: {value}</Text> : null)}
    {item.notes ? <Text className="rounded-xl bg-muted p-3 text-sm">{item.notes}</Text> : null}
    <View className="gap-2">
      {item.documents.map((document) => <Button key={document.fileId} size="sm" variant="outline" className="w-full" onPress={() => Platform.OS === "web" ? filesService.openAuthenticatedFile(document.fileId, document.type) : Linking.openURL(document.url || filesService.getImageUrl(document.fileId, "request_documents"))}><Text numberOfLines={1}>Ver {document.name}</Text></Button>)}
    </View>
    {user?.role === "enlace" && item.status === "pendiente_canalizacion" ? <View className="gap-3 border-t border-border pt-4">
      <GlassSelect label="Área responsable" required placeholder={units.isLoading ? "Cargando áreas..." : "Selecciona el área"} disabled={units.isLoading} options={(units.data || []).map((unit) => ({ value: unit.id, label: unit.name }))} value={unitId} onChange={setUnitId} />
      <GlassInput label="Criterio de canalización" type="textarea" value={comment} onChangeText={setComment} />
      <Button disabled={!unitId || update.isPending} onPress={() => update.mutate({ unitId, comment })}><Text>{update.isPending ? "Canalizando..." : "Confirmar canalización"}</Text></Button>
    </View> : null}
    {canWork && item.status !== "atendida" && item.status !== "cancelada" && item.status !== "pendiente_canalizacion" ? <View className={`${compact ? "gap-2" : "flex-row flex-wrap gap-2"} border-t border-border pt-4`}>
      <Button className={compact ? "w-full" : ""} size="sm" variant="outline" disabled={update.isPending} onPress={() => update.mutate({ status: "en_atencion" })}><Text>En atención</Text></Button>
      <Button className={compact ? "w-full" : ""} size="sm" variant="outline" disabled={update.isPending} onPress={() => update.mutate({ status: "requiere_informacion" })}><Text>Solicitar información</Text></Button>
      {(canClose || item.route === "canalizada") ? <Button className={compact ? "w-full" : ""} size="sm" disabled={update.isPending} onPress={() => update.mutate({ status: "atendida" })}><Text>Marcar atendida</Text></Button> : null}
    </View> : null}
    {update.error ? <Text className="text-sm text-destructive">{update.error.message}</Text> : null}
  </View>;
}

export default function SecretaryRequestsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const globalForm = useGlobalForm();
  const activeEvents = useActiveEvents();
  const canCreate = user?.role === "secretaria" || user?.role === "capturista_secretaria" || user?.role === "enlace" || user?.role === "super_admin";
  const canManageOnThisPlatform =
    user?.role === "enlace" ||
    (Platform.OS === "web" && user?.role === "gestor");
  const allowed = canCreate || canManageOnThisPlatform;
  const [section, setSection] = useState<"new" | "queue">(
    user?.role === "enlace" || !canCreate ? "queue" : "new",
  );
  const activeSection = compact && canCreate ? "new" : section;
  const [applicantData, setApplicantData] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState("");
  const [source, setSource] = useState<"gobernador" | "oficina_gubernamental" | "otra">("gobernador");
  const [officeNumber, setOfficeNumber] = useState("");
  const [officeDate, setOfficeDate] = useState("");
  const [notes, setNotes] = useState("");
  const [route, setRoute] = useState<"secretaria" | "canalizacion">("canalizacion");
  const [documents, setDocuments] = useState<SecretaryRequestDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [registeredRequest, setRegisteredRequest] = useState<SecretaryRequest>();
  const [receiptEmailMessage, setReceiptEmailMessage] = useState<string>();
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  // La solicitud se registra en el evento elegido en el selector de ubicación
  // de Inicio (si no hay uno, en el primer evento activo).
  const homeEventId = useSelectedEventId();
  const homeEvent = activeEvents.data?.find((event) => event.id === homeEventId);
  const effectiveEventId = homeEvent?.id || activeEvents.data?.[0]?.id || "";

  const globalFields = globalForm.data?.fields || [];
  const hasGlobalDocumentField = globalFields.some((field) => field.type === "file");
  const globalDocuments = globalFields.flatMap((field) => {
    if (field.type !== "file" || !applicantData[field.key]) return [];
    try {
      const parsed = JSON.parse(applicantData[field.key]) as SecretaryRequestDocument | SecretaryRequestDocument[];
      const fieldDocuments = Array.isArray(parsed) ? parsed : [parsed];
      return fieldDocuments.filter((document) => Boolean(document?.fileId));
    } catch {
      return [];
    }
  });
  const requestDocuments = [...globalDocuments, ...documents].filter(
    (document, index, items) =>
      items.findIndex((item) => item.fileId === document.fileId) === index,
  );
  const recipientEmail = (() => {
    const field = globalFields.find((item) =>
      /correo|email/i.test(`${item.key} ${item.label}`),
    );
    return field ? applicantData[field.key]?.trim() : undefined;
  })();

  const queue = useQuery({
    queryKey: ["secretary-requests", user?.role],
    queryFn: identityApi.listSecretaryRequests,
    enabled: allowed && activeSection === "queue",
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: activeSection === "queue" ? 10_000 : false,
  });
  const submit = useMutation({
    mutationFn: () => identityApi.submitSecretaryRequest({ applicantData, subject, source, officeNumber, officeDate, notes, route, eventId: effectiveEventId, recipientEmail, documents: requestDocuments }),
    onSuccess: async ({ request, emailMessage }) => {
      const selectedEvent = activeEvents.data?.find((event) => event.id === effectiveEventId);
      const requestWithEvent: SecretaryRequest = {
        ...request,
        eventId: request.eventId || effectiveEventId,
        eventFolio: request.eventFolio || selectedEvent?.folioPrefix,
      };
      await queryClient.invalidateQueries({ queryKey: ["secretary-requests"] });
      queryClient.setQueryData<{ requests: SecretaryRequest[] }>(
        ["my-secretary-requests", user?.id],
        (current) => ({
          requests: [
            requestWithEvent,
            ...(current?.requests || []).filter((item) => item.id !== requestWithEvent.id),
          ],
        }),
      );
      setRegisteredRequest(requestWithEvent);
      setReceiptEmailMessage(emailMessage);
      setReceiptVisible(true);
      setApplicantData({});
      setSubject("");
      setSource("gobernador");
      setOfficeNumber("");
      setOfficeDate("");
      setNotes("");
      setRoute("canalizacion");
      setDocuments([]);
      setUploadError(undefined);
      setFormResetKey((current) => current + 1);
      if (Platform.OS === "web") setSection("queue");
    },
  });
  if (!allowed) return <Redirect href="/home" />;

  const upload = async (file: File | { uri: string; name: string; type: string; size?: number }) => {
    setUploading(true);
    setUploadError(undefined);
    try { const item = await filesService.uploadImage(file, "request_documents"); setDocuments((current) => [...current, { fileId: item.filename, name: item.originalname, type: item.mimetype, size: item.size, url: item.url }]); }
    catch (cause) { setUploadError(cause instanceof Error ? cause.message : "No fue posible subir el documento"); }
    finally { setUploading(false); }
  };
  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) { const asset = result.assets[0]; await upload(asset.file || { uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream", size: asset.size }); }
  };
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (!result.canceled && result.assets[0]) { const asset = result.assets[0]; await upload(asset.file || { uri: asset.uri, name: asset.fileName || `oficio-${Date.now()}.jpg`, type: asset.mimeType || "image/jpeg", size: asset.fileSize }); }
  };
  const valid = effectiveEventId && subject.trim() && isDynamicFormComplete(globalFields, applicantData);

  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-background">
    <CollapsingHeaderScrollView
      title="Atención de Secretaría"
      subtitle="Oficios y solicitudes institucionales prioritarias"
      largeTitleAlign="center"
      headerLeft={<GlassIconButton icon="ic:baseline-arrow-back-ios-new" accessibilityLabel="Regresar" onPress={() => router.back()} size={40} />}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: compact ? 20 : 24, paddingBottom: Math.max(insets.bottom + 32, 64) }}
    ><View className="mx-auto w-full max-w-4xl gap-5">
    {canCreate && !compact ? <View className="flex-row border-b border-border"><Pressable accessibilityRole="tab" accessibilityState={{ selected: section === "new" }} onPress={() => setSection("new")} className={`min-h-12 flex-1 items-center justify-center border-b-2 px-2 py-3 ${section === "new" ? "border-primary" : "border-transparent"}`}><Text className="text-center text-sm font-semibold">Nueva solicitud</Text></Pressable><Pressable accessibilityRole="tab" accessibilityState={{ selected: section === "queue" }} onPress={() => setSection("queue")} className={`min-h-12 flex-1 items-center justify-center border-b-2 px-2 py-3 ${section === "queue" ? "border-primary" : "border-transparent"}`}><Text className="text-center text-sm font-semibold">Bandeja administrativa</Text></Pressable></View> : null}
      {activeSection === "new" ? <>
        {!activeEvents.isLoading && !effectiveEventId ? (
          <Text className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No hay un evento activo. Elige uno desde Inicio para registrar la solicitud.</Text>
        ) : null}
        {globalForm.isLoading ? <ActivityIndicator color="#981646" /> : <View className="gap-5">
          {globalForm.data?.enableINEAnalysis ? <INEAutoFill key={`ine-${formResetKey}`} fields={globalForm.data.fields || []} values={applicantData} onChange={setApplicantData} /> : null}
          <DynamicGlobalForm key={`global-${formResetKey}`} appearance="glass" fields={globalForm.data?.fields || []} values={applicantData} onChange={setApplicantData} title="Datos del solicitante" description="Información del formulario general." />
        </View>}
        <View className="gap-4 rounded-2xl border border-border bg-card p-4">
          <Text className="text-xl font-bold">Datos del oficio</Text>
          <GlassInput key={`subject-${formResetKey}`} label="Asunto o resumen" type="textarea" required value={subject} onChangeText={setSubject} placeholder="Describe brevemente el asunto" />
          <GlassSelect label="Procedencia" required options={Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))} value={source} onChange={(value) => setSource(value as typeof source)} />
          <GlassInput label="Número de oficio" value={officeNumber} onChangeText={setOfficeNumber} placeholder="Opcional" />
          <GlassInput label="Fecha del oficio" value={officeDate} onChangeText={setOfficeDate} placeholder="AAAA-MM-DD (opcional)" keyboardType="numbers-and-punctuation" />
          <GlassInput label="Observaciones" type="textarea" value={notes} onChangeText={setNotes} placeholder="Opcional" />
        </View>
        {!hasGlobalDocumentField ? <View className="gap-4 rounded-2xl border border-border bg-card p-4"><Text className="text-xl font-bold">Documento recibido <Text className="text-base font-normal text-muted-foreground">(opcional)</Text></Text><Text className="text-muted-foreground">Si cuentas con un documento, adjunta fotografías legibles o el PDF original.</Text><View className={compact ? "gap-2" : "flex-row gap-3"}><Button className={compact ? "w-full" : "flex-1"} variant="outline" disabled={uploading} onPress={takePhoto}><Text>Tomar foto</Text></Button><Button className={compact ? "w-full" : "flex-1"} variant="outline" disabled={uploading} onPress={pickDocument}><Text>{uploading ? "Subiendo..." : "Elegir archivo"}</Text></Button></View>{uploadError ? <Text className="text-sm text-destructive">{uploadError}</Text> : null}{documents.map((document) => <View key={document.fileId} className="flex-row items-center justify-between gap-3 rounded-xl bg-muted p-3"><Text className="min-w-0 flex-1" numberOfLines={1}>{document.name}</Text><Pressable onPress={() => setDocuments((current) => current.filter((item) => item.fileId !== document.fileId))}><Text className="text-destructive">Quitar</Text></Pressable></View>)}</View> : null}
        <View className="gap-4 rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">¿Quién atenderá?</Text><GlassSelect required options={[{ value: "secretaria", label: "Atender por Secretaría" }, { value: "canalizacion", label: "Enviar al Enlace de canalización" }]} value={route} onChange={(value) => setRoute(value as typeof route)} /><Text className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">La solicitud se registrará con prioridad alta y conservará quién realizó la captura.</Text></View>
        {submit.error ? <Text className="text-destructive">{submit.error.message}</Text> : null}
        {/* Guardar: palomita al final del formulario, como en los pasos de nueva solicitud. */}
        <View className="items-center pt-2"><GlassIconButton variant="primary" icon="mdi:check" accessibilityLabel="Registrar solicitud prioritaria" onPress={() => submit.mutate()} disabled={!valid || uploading} loading={submit.isPending} /></View>
      </> : queue.isLoading ? <ActivityIndicator color="#981646" /> : queue.data?.requests.length ? queue.data.requests.map((item) => <RequestCard key={item.id} item={item} canClose={user?.role === "secretaria" || user?.role === "super_admin"} />) : <Text className="py-16 text-center text-muted-foreground">No hay solicitudes en esta bandeja.</Text>}
    </View></CollapsingHeaderScrollView>
    <Modal visible={receiptVisible} transparent animationType="fade" onRequestClose={() => setReceiptVisible(false)}>
      <View className="flex-1 items-center justify-center bg-black/60 px-5">
        <View className="w-full max-w-md overflow-hidden rounded-3xl bg-background">
          <View className="h-1.5" style={{ backgroundColor: "#D6AD60" }} />
          <View className="items-center px-6 pb-2 pt-6">
            <Text className="text-xs font-bold uppercase tracking-widest text-primary">Solicitud registrada</Text>
            <Text className="mt-3 text-3xl font-bold text-foreground">{registeredRequest?.folio}</Text>
            <Text className="mt-2 text-center text-sm text-muted-foreground">Conserva este folio para dar seguimiento.</Text>
          </View>
          <View className="gap-2 px-6 py-5">
            <View className="h-px bg-border" />
            <Text className="mt-2 text-sm text-muted-foreground">Folio del evento</Text>
            <Text className="font-semibold">{registeredRequest?.eventFolio || "No disponible"}</Text>
            <Text className="mt-2 text-sm text-muted-foreground">Asunto</Text>
            <Text className="font-semibold">{registeredRequest?.subject}</Text>
            {receiptEmailMessage ? <Text className="mt-3 text-center text-xs text-muted-foreground">{receiptEmailMessage}</Text> : null}
            <Button className="mt-3" onPress={() => { setReceiptVisible(false); setRegisteredRequest(undefined); setReceiptEmailMessage(undefined); }}><Text>Nueva captura</Text></Button>
          </View>
        </View>
      </View>
    </Modal>
  </KeyboardAvoidingView>;
}
