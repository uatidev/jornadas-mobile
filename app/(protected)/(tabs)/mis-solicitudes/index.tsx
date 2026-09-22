import { Button } from "@/src/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Text } from "@/src/components/ui/text";
import { useActiveEvents, useGlobalForm, useServicesCatalog } from "@/src/hooks/useCatalog";
import { useAuth } from "@/src/providers/AuthProvider";
import { identityApi } from "@/src/services/identityApi";
import { requestsService } from "@/src/services/requests";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const detailValue = (value: unknown) => {
  if (typeof value !== "string") return String(value ?? "—");
  try {
    const parsed = JSON.parse(value);
    return parsed?.name ? `Archivo: ${parsed.name}` : value;
  } catch {
    return value || "—";
  }
};

function DetailRows({ data, labels = {} }: { data?: Record<string, unknown>; labels?: Record<string, string> }) {
  const entries = Object.entries(data || {}).filter(([, value]) => value !== "" && value != null);
  if (!entries.length) return <Text className="text-sm text-muted-foreground">Sin información adicional.</Text>;
  return (
    <View className="gap-3">
      {entries.map(([key, value]) => (
        <View key={key} className="border-b border-border/50 pb-2">
          <Text className="text-[11px] font-bold uppercase text-muted-foreground">
            {labels[key] || key.replace(/^pregunta_?/, "Pregunta ").replaceAll("_", " ")}
          </Text>
          <Text className="mt-1 text-sm">{detailValue(value)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function MisSolicitudesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [requestType, setRequestType] = useState<"all" | "regular" | "secretary">("all");
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const activeEvents = useActiveEvents();
  const services = useServicesCatalog();
  const globalForm = useGlobalForm();
  const requests = useQuery({
    queryKey: ["my-captured-requests", user?.id],
    queryFn: () => requestsService.listByCapturista(user!.id),
    enabled: Boolean(user?.id),
  });
  const canSeeSecretaryRequests = Boolean(
    user?.role === "secretaria" ||
    user?.role === "capturista_secretaria" ||
    user?.role === "enlace" ||
    user?.role === "gestor" ||
    user?.role === "super_admin",
  );
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
    enabled: Boolean(user?.id) && canSeeSecretaryRequests,
    staleTime: 30_000,
  });

  const effectiveEventId =
    selectedEventId && activeEvents.data?.some((event) => event.id === selectedEventId)
      ? selectedEventId
      : activeEvents.data?.[0]?.id || "";
  const selectedEvent = activeEvents.data?.find((event) => event.id === effectiveEventId);
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
  const requestsForEvent = useMemo(
    () => (requests.data || []).filter((request) => request.eventId === effectiveEventId),
    [requests.data, effectiveEventId],
  );
  const secretaryRequestsForEvent = useMemo(
    () =>
      (secretaryRequests.data?.requests || []).filter(
        (request) => request.eventId === effectiveEventId,
      ),
    [secretaryRequests.data?.requests, effectiveEventId],
  );
  const showRegular = requestType !== "secretary";
  const showSecretary = canSeeSecretaryRequests && requestType !== "regular";
  const capturedTotal =
    requestType === "regular"
      ? requestsForEvent.length
      : requestType === "secretary"
        ? secretaryRequestsForEvent.length
        : requestsForEvent.length + secretaryRequestsForEvent.length;
  const loading = activeEvents.isLoading || services.isLoading || globalForm.isLoading || requests.isLoading || (canSeeSecretaryRequests && secretaryRequests.isLoading);

  return (
    <View className="flex-1 bg-background">
      <View
        className="border-b border-border bg-background px-6 pb-5"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Text className="text-center text-xl font-bold">Mis solicitudes</Text>
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          Consulta las solicitudes que has capturado por evento.
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: insets.bottom + 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={requests.isRefetching}
            onRefresh={() => {
              void Promise.all([
                requests.refetch(),
                activeEvents.refetch(),
                services.refetch(),
                ...(canSeeSecretaryRequests ? [secretaryRequests.refetch()] : []),
              ]);
            }}
          />
        }
      >
        <View className="mx-auto w-full max-w-[672px] gap-5">
          {canSeeSecretaryRequests ? (
            <View className="flex-row rounded-xl bg-muted p-1">
              {([
                ["all", "Todas"],
                ["regular", "Trámites"],
                ["secretary", "Secretaria"],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setRequestType(value)}
                  className={`flex-1 rounded-lg px-2 py-2.5 ${requestType === value ? "bg-background" : ""}`}
                >
                  <Text className={`text-center text-xs ${requestType === value ? "font-bold text-primary" : "text-muted-foreground"}`}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {activeEvents.data?.length ? (
            <View className="gap-3">
              <Text className="font-semibold">Selecciona un evento</Text>
              <Select
                value={selectedEvent ? { label: selectedEvent.name, value: selectedEvent.id } : undefined}
                onValueChange={(option) => {
                  if (option?.value) setSelectedEventId(option.value);
                }}
              >
                <SelectTrigger className="h-12 w-full rounded-xl px-4">
                  <SelectValue placeholder="Selecciona un evento activo" />
                </SelectTrigger>
                <SelectContent
                  insets={{ top: insets.top, bottom: insets.bottom, left: 16, right: 16 }}
                >
                  <SelectGroup>
                    {activeEvents.data.map((event) => (
                      <SelectItem
                        key={event.id}
                        label={`${event.name} · ${event.municipality}`}
                        value={event.id}
                      >
                        {event.name} · {event.municipality}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {selectedEvent ? (
                <Text className="text-xs text-muted-foreground">
                  {selectedEvent.venue} · {selectedEvent.locality}
                </Text>
              ) : null}
            </View>
          ) : null}

          {selectedEvent ? (
            <View className="rounded-2xl bg-primary p-5">
              <Text className="text-sm text-primary-foreground/80">Capturas realizadas en</Text>
              <Text className="mt-1 text-lg font-bold text-primary-foreground">
                {selectedEvent.name}
              </Text>
              <Text className="mt-4 text-4xl font-bold text-primary-foreground">
                {capturedTotal}
              </Text>
              <Text className="mt-1 text-sm text-primary-foreground/80">
                {capturedTotal === 1 ? "solicitud capturada" : "solicitudes capturadas"}
              </Text>
            </View>
          ) : null}

          {loading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#981646" />
              <Text className="mt-3 text-muted-foreground">Cargando solicitudes...</Text>
            </View>
          ) : activeEvents.error || requests.error || secretaryRequests.error ? (
            <View className="rounded-2xl border border-destructive/30 bg-card p-5">
              <Text className="font-semibold text-destructive">
                No fue posible cargar tus solicitudes.
              </Text>
              <Button className="mt-4" onPress={() => {
                void requests.refetch();
                if (canSeeSecretaryRequests) void secretaryRequests.refetch();
              }}>
                <Text>Reintentar</Text>
              </Button>
            </View>
          ) : (
            <>
              {showRegular ? (
                !activeEvents.data?.length ? (
                  <View className="items-center rounded-2xl border border-border bg-card px-5 py-12">
                    <Text className="text-lg font-bold">No hay eventos activos</Text>
                    <Text className="mt-2 text-center text-muted-foreground">Las capturas de trámites aparecerán cuando exista un evento activo.</Text>
                  </View>
                ) : requestsForEvent.length ? (
                  <View className="gap-3">
                    <Text className="text-lg font-bold">Trámites regulares</Text>
                    {requestsForEvent.map((request) => (
                      <View key={request.id} className="rounded-2xl border border-border bg-card p-4">
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="flex-1">
                            <Text className="font-bold text-primary">{request.folio}</Text>
                            <Text className="mt-1 font-semibold">{serviceNames[request.serviceId] || "Trámite no disponible"}</Text>
                            <Text className="mt-2 self-start rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">Trámite regular</Text>
                          </View>
                          <Text className="rounded-full bg-muted px-3 py-1 text-xs capitalize">{request.status === "en_espera_apertura" ? "En espera de apertura" : request.status.replaceAll("_", " ")}</Text>
                        </View>
                        <View className="mt-3 flex-row items-center justify-between gap-3">
                          <Text className="text-xs text-muted-foreground">{new Date(request.requestedAt).toLocaleString("es-MX")}</Text>
                          {request.priorityOnReopening ? <Text className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Prioritaria</Text> : null}
                        </View>
                        <Button
                          className="mt-4 w-full"
                          variant="outline"
                          onPress={() => setExpandedRequest((current) => current === `regular-${request.id}` ? null : `regular-${request.id}`)}
                        >
                          <Text>{expandedRequest === `regular-${request.id}` ? "Ocultar detalle" : "Ver detalle"}</Text>
                        </Button>
                        {expandedRequest === `regular-${request.id}` ? (
                          <View className="mt-4 gap-4 border-t border-border pt-4">
                            <View>
                              <Text className="mb-3 font-bold">Datos del solicitante</Text>
                              <DetailRows data={request.applicantData} labels={globalFieldLabels} />
                            </View>
                            <View>
                              <Text className="mb-3 font-bold">Datos del trámite</Text>
                              <DetailRows data={request.requestData} labels={serviceFieldLabels[request.serviceId]} />
                            </View>
                            {request.notes ? (
                              <View><Text className="font-bold">Observaciones</Text><Text className="mt-1 text-sm">{request.notes}</Text></View>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="items-center rounded-2xl border border-border bg-card px-5 py-10">
                    <Text className="font-bold">Sin trámites en este evento</Text>
                  </View>
                )
              ) : null}

              {showSecretary ? (
                secretaryRequestsForEvent.length ? (
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-lg font-bold">Atención de Secretaria</Text>
                      <Text className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{secretaryRequestsForEvent.length}</Text>
                    </View>
                    {secretaryRequestsForEvent.map((request) => (
                      <View key={`secretary-${request.id}`} className="rounded-2xl border border-border bg-card p-4">
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="min-w-0 flex-1">
                            <Text className="font-bold text-primary">{request.folio}</Text>
                            <Text className="mt-1 font-semibold">{request.subject}</Text>
                          </View>
                          <Text className="rounded-full bg-muted px-3 py-1 text-xs capitalize">{request.status.replaceAll("_", " ")}</Text>
                        </View>
                        <Text className="mt-3 text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleString("es-MX")}</Text>
                        <Button
                          className="mt-4 w-full"
                          variant="outline"
                          onPress={() => setExpandedRequest((current) => current === `secretary-${request.id}` ? null : `secretary-${request.id}`)}
                        >
                          <Text>{expandedRequest === `secretary-${request.id}` ? "Ocultar detalle" : "Ver detalle"}</Text>
                        </Button>
                        {expandedRequest === `secretary-${request.id}` ? (
                          <View className="mt-4 gap-4 border-t border-border pt-4">
                            <View><Text className="mb-3 font-bold">Datos del solicitante</Text><DetailRows data={request.applicantData} labels={globalFieldLabels} /></View>
                            <View className="gap-2">
                              <Text><Text className="font-bold">Procedencia: </Text>{request.source.replaceAll("_", " ")}</Text>
                              <Text><Text className="font-bold">Ruta de atención: </Text>{request.route.replaceAll("_", " ")}</Text>
                              {request.officeNumber ? <Text><Text className="font-bold">Número de oficio: </Text>{request.officeNumber}</Text> : null}
                              {request.officeDate ? <Text><Text className="font-bold">Fecha del oficio: </Text>{new Date(request.officeDate).toLocaleDateString("es-MX")}</Text> : null}
                              {request.notes ? <Text><Text className="font-bold">Observaciones: </Text>{request.notes}</Text> : null}
                              <Text><Text className="font-bold">Documentos adjuntos: </Text>{request.documents.length}</Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="items-center rounded-2xl border border-amber-200 bg-amber-50 px-5 py-10">
                    <Text className="font-bold text-amber-950">Sin capturas de Secretaría</Text>
                    <Text className="mt-2 text-center text-sm text-amber-800">Las solicitudes institucionales que registres aparecerán aquí.</Text>
                  </View>
                )
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
