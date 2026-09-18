import { DynamicGlobalForm, INEAutoFill, isDynamicFormComplete } from "@/src/components/modules/new-request";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import { useActiveEvents, useGlobalForm } from "@/src/hooks/useCatalog";
import { useAuth } from "@/src/providers/AuthProvider";
import { adminService } from "@/src/services/admin";
import { filesService } from "@/src/services/files";
import { identityApi } from "@/src/services/identityApi";
import type { SecretaryRequest, SecretaryRequestDocument, SecretaryRequestStatus } from "@/src/types/request";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Redirect, usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
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

function Choice({ active, label, onPress, fullWidth = false }: { active: boolean; label: string; onPress: () => void; fullWidth?: boolean }) {
  return <Pressable onPress={onPress} className={`${fullWidth ? "w-full" : ""} rounded-xl border px-4 py-3 ${active ? "border-primary bg-primary/10" : "border-border bg-background"}`}><Text className={active ? "font-semibold text-primary" : ""}>{label}</Text></Pressable>;
}

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
    <Text className="text-sm">Capturó: {item.capturedByName}{item.capturedOnBehalfOfSecretary ? " · En nombre de Secretaria" : ""}</Text>
    {item.officeNumber ? <Text className="text-sm">Oficio: {item.officeNumber}</Text> : null}
    {item.eventFolio ? <Text className="text-sm">Evento: {item.eventFolio}</Text> : null}
    {Object.entries(item.applicantData).map(([key, value]) => value ? <Text key={key} className="text-sm text-muted-foreground">{key}: {value}</Text> : null)}
    {item.notes ? <Text className="rounded-xl bg-muted p-3 text-sm">{item.notes}</Text> : null}
    <View className="gap-2">
      {item.documents.map((document) => <Button key={document.fileId} size="sm" variant="outline" className="w-full" onPress={() => Platform.OS === "web" ? filesService.openAuthenticatedFile(document.fileId, document.type) : Linking.openURL(document.url || filesService.getImageUrl(document.fileId, "request_documents"))}><Text numberOfLines={1}>Ver {document.name}</Text></Button>)}
    </View>
    {user?.role === "enlace" && item.status === "pendiente_canalizacion" ? <View className="gap-3 border-t border-border pt-4">
      <Text className="font-semibold">Área responsable</Text>
      <View className="gap-2">{units.data?.map((unit) => <Choice key={unit.id} fullWidth active={unitId === unit.id} label={unit.name} onPress={() => setUnitId(unit.id)} />)}</View>
      <Input value={comment} onChangeText={setComment} placeholder="Criterio de canalización" multiline className="min-h-20" />
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
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const renderedInsideSecretaryTab = pathname.includes("/secretaria");
  const globalForm = useGlobalForm();
  const activeEvents = useActiveEvents();
  const canCreate = user?.role === "secretaria" || user?.role === "capturista_secretaria" || user?.role === "enlace" || user?.role === "super_admin";
  const canManageOnThisPlatform =
    user?.role === "enlace" ||
    (Platform.OS === "web" && user?.role === "gestor");
  const allowed = canCreate || canManageOnThisPlatform;
  const [section, setSection] = useState<"new" | "queue">(canCreate ? "new" : "queue");
  const [applicantData, setApplicantData] = useState<Record<string, string>>({});
  const [selectedEventId, setSelectedEventId] = useState("");
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

  const effectiveEventId = selectedEventId || activeEvents.data?.[0]?.id || "";

  const globalFields = globalForm.data?.fields || [];
  const hasGlobalDocumentField = globalFields.some((field) => field.type === "file");
  const globalDocuments = globalFields.flatMap((field) => {
    if (field.type !== "file" || !applicantData[field.key]) return [];
    try {
      const document = JSON.parse(applicantData[field.key]) as SecretaryRequestDocument;
      return document.fileId ? [document] : [];
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

  const queue = useQuery({ queryKey: ["secretary-requests", user?.role], queryFn: identityApi.listSecretaryRequests, enabled: allowed && section === "queue" });
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

  const upload = async (file: File | { uri: string; name: string; type: string }) => {
    setUploading(true);
    setUploadError(undefined);
    try { const item = await filesService.uploadImage(file, "request_documents"); setDocuments((current) => [...current, { fileId: item.filename, name: item.originalname, type: item.mimetype, size: item.size, url: item.url }]); }
    catch (cause) { setUploadError(cause instanceof Error ? cause.message : "No fue posible subir el documento"); }
    finally { setUploading(false); }
  };
  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) { const asset = result.assets[0]; await upload(asset.file || { uri: asset.uri, name: asset.name, type: asset.mimeType || "application/octet-stream" }); }
  };
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (!result.canceled && result.assets[0]) { const asset = result.assets[0]; await upload(asset.file || { uri: asset.uri, name: asset.fileName || `oficio-${Date.now()}.jpg`, type: asset.mimeType || "image/jpeg" }); }
  };
  const valid = effectiveEventId && subject.trim() && isDynamicFormComplete(globalFields, applicantData);

  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-background">
    <View className="border-b border-border px-4 pb-4" style={{ paddingTop: Math.max(insets.top, 12) }}><View className={`mx-auto w-full max-w-4xl ${compact ? "gap-3" : "flex-row items-center justify-between"}`}><View className="min-w-0 flex-1"><Text className={`${compact ? "text-xl" : "text-2xl"} font-bold`}>Atención de Secretaria</Text><Text className="mt-1 text-sm text-muted-foreground">Oficios y solicitudes institucionales prioritarias</Text></View>{!renderedInsideSecretaryTab ? <Button className={compact ? "w-full" : ""} variant="outline" onPress={() => router.back()}><Text>Regresar</Text></Button> : null}</View></View>
    {canCreate && Platform.OS === "web" ? <View className="flex-row border-b border-border px-6"><Pressable onPress={() => setSection("new")} className={`flex-1 border-b-2 py-4 ${section === "new" ? "border-primary" : "border-transparent"}`}><Text className="text-center font-semibold">Nueva solicitud</Text></Pressable><Pressable onPress={() => setSection("queue")} className={`flex-1 border-b-2 py-4 ${section === "queue" ? "border-primary" : "border-transparent"}`}><Text className="text-center font-semibold">Bandeja administrativa</Text></Pressable></View> : null}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: compact ? 16 : 24, paddingBottom: Math.max(insets.bottom + 32, 64) }}><View className="mx-auto w-full max-w-4xl gap-5">
      {section === "new" ? <>
        <View className="gap-3 rounded-2xl border border-border bg-card p-4">
          <Text className="text-xl font-bold">Evento de atención *</Text>
          <Text className="text-sm text-muted-foreground">La solicitud quedará registrada dentro del evento seleccionado.</Text>
          {activeEvents.isLoading ? <ActivityIndicator color="#981646" /> : activeEvents.data?.length ? <View className="gap-2">{activeEvents.data.map((event) => <Choice key={event.id} fullWidth active={effectiveEventId === event.id} label={`${event.name} · ${event.municipality}`} onPress={() => setSelectedEventId(event.id)} />)}</View> : <Text className="text-sm text-destructive">No hay eventos activos disponibles.</Text>}
        </View>
        {globalForm.isLoading ? <ActivityIndicator color="#981646" /> : <View className="gap-5">
          {globalForm.data?.enableINEAnalysis ? <INEAutoFill key={`ine-${formResetKey}`} fields={globalForm.data.fields || []} values={applicantData} onChange={setApplicantData} /> : null}
          <DynamicGlobalForm key={`global-${formResetKey}`} fields={globalForm.data?.fields || []} values={applicantData} onChange={setApplicantData} title="Datos del solicitante" description="Información del formulario general." />
        </View>}
        <View className="gap-4 rounded-2xl border border-border bg-card p-4"><Text className="text-xl font-bold">Datos del oficio</Text><Input value={subject} onChangeText={setSubject} placeholder="Asunto o resumen *" multiline className="min-h-24" /><Text className="font-semibold">Procedencia</Text><View className="gap-2">{Object.entries(SOURCE_LABELS).map(([value, label]) => <Choice key={value} fullWidth active={source === value} label={label} onPress={() => setSource(value as typeof source)} />)}</View><Input value={officeNumber} onChangeText={setOfficeNumber} placeholder="Número de oficio (opcional)" /><Input value={officeDate} onChangeText={setOfficeDate} placeholder="Fecha del oficio: AAAA-MM-DD (opcional)" /><Input value={notes} onChangeText={setNotes} placeholder="Observaciones" multiline className="min-h-24" /></View>
        {!hasGlobalDocumentField ? <View className="gap-4 rounded-2xl border border-border bg-card p-4"><Text className="text-xl font-bold">Documento recibido <Text className="text-base font-normal text-muted-foreground">(opcional)</Text></Text><Text className="text-muted-foreground">Si cuentas con un documento, adjunta fotografías legibles o el PDF original.</Text><View className={compact ? "gap-2" : "flex-row gap-3"}><Button className={compact ? "w-full" : "flex-1"} variant="outline" disabled={uploading} onPress={takePhoto}><Text>Tomar foto</Text></Button><Button className={compact ? "w-full" : "flex-1"} variant="outline" disabled={uploading} onPress={pickDocument}><Text>{uploading ? "Subiendo..." : "Elegir archivo"}</Text></Button></View>{uploadError ? <Text className="text-sm text-destructive">{uploadError}</Text> : null}{documents.map((document) => <View key={document.fileId} className="flex-row items-center justify-between gap-3 rounded-xl bg-muted p-3"><Text className="min-w-0 flex-1" numberOfLines={1}>{document.name}</Text><Pressable onPress={() => setDocuments((current) => current.filter((item) => item.fileId !== document.fileId))}><Text className="text-destructive">Quitar</Text></Pressable></View>)}</View> : null}
        <View className="gap-4 rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">¿Quién atenderá?</Text><Choice active={route === "secretaria"} label="Atender por Secretaria" onPress={() => setRoute("secretaria")} /><Choice active={route === "canalizacion"} label="Enviar al Enlace de canalización" onPress={() => setRoute("canalizacion")} /><Text className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">La solicitud se registrará con prioridad alta y conservará quién realizó la captura.</Text></View>
        {submit.error ? <Text className="text-destructive">{submit.error.message}</Text> : null}<Button disabled={!valid || submit.isPending || uploading} onPress={() => submit.mutate()}><Text>{submit.isPending ? "Registrando..." : "Registrar solicitud prioritaria"}</Text></Button>
      </> : queue.isLoading ? <ActivityIndicator color="#981646" /> : queue.data?.requests.length ? queue.data.requests.map((item) => <RequestCard key={item.id} item={item} canClose={user?.role === "secretaria" || user?.role === "super_admin"} />) : <Text className="py-16 text-center text-muted-foreground">No hay solicitudes en esta bandeja.</Text>}
    </View></ScrollView>
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
