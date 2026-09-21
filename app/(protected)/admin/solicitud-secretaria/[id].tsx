"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import { useAuth } from "@/src/providers/AuthProvider";
import { adminService } from "@/src/services/admin";
import { identityApi } from "@/src/services/identityApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

export default function SecretaryRequestAdminDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Array.isArray(id) ? id[0] : id;
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canView = user?.role === "super_admin" || user?.role === "enlace";
  const query = useQuery({
    queryKey: ["secretary-request-detail", requestId],
    queryFn: identityApi.listSecretaryRequests,
    enabled: Boolean(requestId && canView),
  });
  const item = query.data?.requests.find((request) => request.id === requestId);
  const globalForm = useQuery({
    queryKey: ["admin", "global-form"],
    queryFn: adminService.getGlobalForm,
    enabled: canView,
  });
  const events = useQuery({ queryKey: ["secretary-request-detail", "events"], queryFn: adminService.listEvents, enabled: canView });
  const units = useQuery({ queryKey: ["secretary-request-detail", "units"], queryFn: adminService.listUnits, enabled: canView });
  const services = useQuery({ queryKey: ["secretary-request-detail", "services"], queryFn: adminService.listServices, enabled: canView });
  const [editing, setEditing] = useState(false);
  const [applicantData, setApplicantData] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState("");
  const [source, setSource] = useState<"gobernador" | "oficina_gubernamental" | "otra">("otra");
  const [officeNumber, setOfficeNumber] = useState("");
  const [officeDate, setOfficeDate] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [receiptEmail, setReceiptEmail] = useState("");
  const [destinationUnitId, setDestinationUnitId] = useState("");
  const [destinationMode, setDestinationMode] = useState<"unit" | "service">("unit");
  const [destinationServiceId, setDestinationServiceId] = useState("");
  const [canalizationComment, setCanalizationComment] = useState("");

  useEffect(() => {
    if (!item || editing) return;
    setApplicantData(item.applicantData || {});
    setSubject(item.subject || "");
    setSource(item.source);
    setOfficeNumber(item.officeNumber || "");
    setOfficeDate(item.officeDate ? item.officeDate.slice(0, 10) : "");
    setNotes(item.notes || "");
    const emailEntry = Object.entries(item.applicantData || {}).find(([key]) => /correo|email/i.test(key));
    if (!receiptEmail && typeof emailEntry?.[1] === "string") setReceiptEmail(emailEntry[1]);
  }, [item, editing, receiptEmail]);

  const save = useMutation({
    mutationFn: () => identityApi.adminUpdateSecretaryRequestData(requestId!, {
      applicantData, subject, source, officeNumber, officeDate, notes, reason,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "secretary-requests"] });
      setEditing(false);
      setReason("");
      setNotice("Datos corregidos correctamente.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });
  const resend = useMutation({
    mutationFn: () => identityApi.resendSecretaryReceipt(requestId!, receiptEmail.trim()),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "email-delivery-report"] });
      setNotice(result.message);
    },
    onError: (cause: Error) => setNotice(cause.message),
  });
  const canalize = useMutation({
    mutationFn: () => identityApi.updateSecretaryRequest(requestId!, { unitId: destinationUnitId, comment: canalizationComment }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["secretary-request-detail", requestId] });
      await queryClient.invalidateQueries({ queryKey: ["enlace", "secretary-requests"] });
      setNotice("Solicitud canalizada correctamente.");
    },
    onError: (cause: Error) => setNotice(cause.message),
  });

  if (!canView) return <Redirect href="/admin" />;
  const selectedEvent = events.data?.find((event) => event.id === item?.eventId);
  return <View className="flex-1 bg-muted/30">
    <View className="flex-row items-center justify-between border-b border-border bg-background px-8 py-5">
      <View><Text className="text-2xl font-bold">Solicitud de Secretaría</Text><Text className="mt-1 text-sm text-muted-foreground">Consulta y corrección administrativa</Text></View>
      <Button variant="outline" onPress={() => router.replace("/admin" as any)}><Text>Regresar</Text></Button>
    </View>
    <ScrollView contentContainerStyle={{ padding: 32 }}><View className="w-full gap-5">
      {query.isLoading ? <ActivityIndicator color="#981646" /> : null}
      {notice ? <Text className="rounded-xl bg-primary/10 p-4 text-primary">{notice}</Text> : null}
      {!query.isLoading && !item ? <Text className="rounded-xl bg-destructive/10 p-4 text-destructive">No se encontró la solicitud.</Text> : null}
      {item ? <View className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5 max-lg:grid-cols-1">
        <View className="min-w-0 gap-5">
        <View className="rounded-2xl border border-border bg-card p-5"><View className="flex-row justify-between gap-4"><View><Text className="text-2xl font-bold">{item.folio}</Text><Text className="mt-1 text-muted-foreground">{new Date(item.createdAt).toLocaleString("es-MX")}</Text></View><Text className="font-semibold capitalize text-primary">{item.status.replaceAll("_", " ")}</Text></View><Text className="mt-4">Capturó: {item.capturedByName}</Text><Text className="mt-1">Documentos adjuntos: {item.documents.length}</Text></View>
        <View className="flex-row flex-wrap gap-x-8 gap-y-2 border-b border-border pb-4">
          <Text><Text className="font-semibold">Folio del evento:</Text> {item.eventFolio || "Sin folio"}</Text>
          <Text><Text className="font-semibold">Evento:</Text> {selectedEvent?.name || "Evento no disponible"}</Text>
          <Text><Text className="font-semibold">Tipo:</Text> Solicitud prioritaria de Secretaría</Text>
          {selectedEvent ? <Text className="text-muted-foreground">{selectedEvent.venue} · {selectedEvent.municipality}</Text> : null}
        </View>
        {false && user?.role === "enlace" && item?.status === "pendiente_canalizacion" ? (
          <View className="sticky top-5 !col-start-2 !row-start-1 gap-4 rounded-2xl border border-primary/30 bg-card p-5 max-lg:static max-lg:!col-start-1">
            <View><Text className="text-xl font-bold">Canalizar solicitud</Text><Text className="mt-1 text-sm text-muted-foreground">Revisa el expediente y selecciona el área competente.</Text></View>
            <View className="flex-row gap-2"><Button size="sm" variant={destinationMode === "unit" ? "default" : "outline"} onPress={() => { setDestinationMode("unit"); setDestinationServiceId(""); setDestinationUnitId(""); }}><Text>Por unidad</Text></Button><Button size="sm" variant={destinationMode === "service" ? "default" : "outline"} onPress={() => { setDestinationMode("service"); setDestinationServiceId(""); setDestinationUnitId(""); }}><Text>Por trámite o servicio</Text></Button></View>
            {destinationMode === "unit" ? <View className="gap-2"><Text className="font-semibold">Unidad responsable *</Text><select value={destinationUnitId} onChange={(event) => setDestinationUnitId(event.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Selecciona una unidad</option>{(units.data || []).filter((unit) => unit.active).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></View> : <View className="gap-2"><Text className="font-semibold">Trámite o servicio *</Text><select value={destinationServiceId} onChange={(event) => { const serviceId = event.currentTarget.value; setDestinationServiceId(serviceId); setDestinationUnitId((services.data || []).find((service) => service.id === serviceId)?.unitId || ""); }} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Selecciona un trámite o servicio</option>{(services.data || []).filter((service) => service.active).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>{destinationUnitId ? <Text className="text-xs text-muted-foreground">Unidad destino: {(units.data || []).find((unit) => unit.id === destinationUnitId)?.name || "Unidad responsable del trámite"}</Text> : null}</View>}
            <View className="gap-2"><Text className="font-semibold">Criterio de canalización</Text><Input value={canalizationComment} onChangeText={setCanalizationComment} placeholder="Explica brevemente por qué corresponde a esta unidad" multiline className="min-h-24" /></View>
            <View className="items-start"><Button disabled={!destinationUnitId || canalize.isPending} onPress={() => canalize.mutate()}><Text>{canalize.isPending ? "Canalizando..." : "Confirmar canalización"}</Text></Button></View>
          </View>
        ) : null}
        <View className="gap-4 rounded-2xl border border-border bg-card p-5">
          <View className="flex-row items-center justify-between"><Text className="text-xl font-bold">Datos de la solicitud</Text>{user?.role === "super_admin" ? <Button variant="outline" onPress={() => setEditing((value) => !value)}><Text>{editing ? "Cancelar" : "Editar datos"}</Text></Button> : null}</View>
          <View className="gap-2"><Text className="font-semibold">Asunto</Text>{editing ? <Input value={subject} onChangeText={setSubject} /> : <Text>{item.subject}</Text>}</View>
          <View className="gap-2"><Text className="font-semibold">Procedencia</Text>{editing ? <View className="flex-row gap-2">{(["gobernador", "oficina_gubernamental", "otra"] as const).map((value) => <Pressable key={value} onPress={() => setSource(value)} className={`rounded-lg border px-3 py-2 ${source === value ? "border-primary bg-primary/10" : "border-border"}`}><Text className="capitalize">{value.replaceAll("_", " ")}</Text></Pressable>)}</View> : <Text className="capitalize">{item.source.replaceAll("_", " ")}</Text>}</View>
          {editing ? <><Input value={officeNumber} onChangeText={setOfficeNumber} placeholder="Número de oficio" /><Input value={officeDate} onChangeText={setOfficeDate} placeholder="Fecha AAAA-MM-DD" /><Input value={notes} onChangeText={setNotes} placeholder="Observaciones" multiline className="min-h-24" /></> : <><Text>Número de oficio: {item.officeNumber || "—"}</Text><Text>Fecha del oficio: {item.officeDate || "—"}</Text><Text>Observaciones: {item.notes || "—"}</Text></>}
        </View>
        <View className="gap-3 rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Datos del solicitante</Text>{Array.from(new Set([...(globalForm.data?.fields || []).map((field) => field.key), ...Object.keys(applicantData)])).map((key) => {
          const field = globalForm.data?.fields.find((candidate) => candidate.key === key);
          const value = applicantData[key] || "";
          return <View key={key} className="gap-1"><Text className="text-xs font-bold uppercase text-muted-foreground">{field?.label || key.replaceAll("_", " ")}{field?.required === false ? " (opcional)" : ""}</Text>{field?.type === "file" ? <Text>{value ? "Archivo protegido" : "Sin archivo"}</Text> : editing ? <Input value={value} onChangeText={(next) => setApplicantData((current) => ({ ...current, [key]: next }))} placeholder={field?.placeholder || "Sin respuesta"} /> : <Text>{value || "Sin respuesta"}</Text>}</View>;
        })}</View>
        {user?.role === "super_admin" ? <View className="gap-3 rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Reenviar comprobante</Text><Text className="text-sm text-muted-foreground">Puedes usar el correo corregido antes de reenviar el folio.</Text><Input value={receiptEmail} onChangeText={setReceiptEmail} autoCapitalize="none" keyboardType="email-address" placeholder="persona@correo.com" /><View className="items-start"><Button disabled={resend.isPending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail.trim())} onPress={() => resend.mutate()}><Text>{resend.isPending ? "Enviando..." : "Reenviar folio"}</Text></Button></View></View> : null}
        {editing ? <View className="gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5"><Text className="font-bold text-amber-950">Motivo de la corrección *</Text><Input value={reason} onChangeText={setReason} placeholder="Explica qué se corrigió y por qué" /><Button disabled={save.isPending || !subject.trim() || reason.trim().length < 5} onPress={() => save.mutate()}><Text>{save.isPending ? "Guardando..." : "Guardar corrección"}</Text></Button></View> : null}
        </View>
        {user?.role === "enlace" && item.status === "pendiente_canalizacion" ? (
          <View className="sticky top-5 gap-4 rounded-2xl border border-primary/30 bg-card p-5 max-lg:static">
            <View><Text className="text-xl font-bold">Acciones</Text><Text className="mt-1 text-sm text-muted-foreground">Revisa el expediente y selecciona el área competente.</Text></View>
            <View className="gap-2"><Text className="font-semibold">Canalizar por *</Text><select value={destinationMode} onChange={(event) => { setDestinationMode(event.currentTarget.value as "unit" | "service"); setDestinationServiceId(""); setDestinationUnitId(""); }} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="unit">Unidad administrativa</option><option value="service">Trámite / servicio / programa</option></select></View>
            {destinationMode === "unit" ? <View className="gap-2"><Text className="font-semibold">Unidad responsable *</Text><select value={destinationUnitId} onChange={(event) => setDestinationUnitId(event.currentTarget.value)} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Selecciona una unidad</option>{(units.data || []).filter((unit) => unit.active).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></View> : <View className="gap-2"><Text className="font-semibold">Trámite, servicio o programa *</Text><select value={destinationServiceId} onChange={(event) => { const serviceId = event.currentTarget.value; setDestinationServiceId(serviceId); setDestinationUnitId((services.data || []).find((service) => service.id === serviceId)?.unitId || ""); }} className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2"><option value="">Selecciona una opción</option>{(services.data || []).filter((service) => service.active).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>{destinationUnitId ? <Text className="text-xs text-muted-foreground">Unidad responsable: {(units.data || []).find((unit) => unit.id === destinationUnitId)?.name || "No disponible"}</Text> : null}</View>}
            <View className="gap-2"><Text className="font-semibold">Criterio de canalización</Text><Input value={canalizationComment} onChangeText={setCanalizationComment} placeholder="Explica brevemente por qué corresponde a esta unidad" multiline className="min-h-24" /></View>
            <Button disabled={!destinationUnitId || canalize.isPending} onPress={() => canalize.mutate()}><Text>{canalize.isPending ? "Canalizando..." : "Confirmar canalización"}</Text></Button>
          </View>
        ) : <View className="rounded-2xl border border-border bg-card p-5"><Text className="text-xl font-bold">Acciones</Text><Text className="mt-2 text-sm text-muted-foreground">Esta solicitud ya no tiene acciones de canalización pendientes.</Text></View>}
      </View> : null}
    </View></ScrollView>
  </View>;
}
