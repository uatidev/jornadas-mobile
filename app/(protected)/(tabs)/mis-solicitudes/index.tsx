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
import { useActiveEvents, useServicesCatalog } from "@/src/hooks/useCatalog";
import { useAuth } from "@/src/providers/AuthProvider";
import { requestsService } from "@/src/services/requests";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MisSolicitudesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedEventId, setSelectedEventId] = useState("");
  const activeEvents = useActiveEvents();
  const services = useServicesCatalog();
  const requests = useQuery({
    queryKey: ["my-captured-requests", user?.id],
    queryFn: () => requestsService.listByCapturista(user!.id),
    enabled: Boolean(user?.id),
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
  const requestsForEvent = useMemo(
    () => (requests.data || []).filter((request) => request.eventId === effectiveEventId),
    [requests.data, effectiveEventId],
  );
  const loading = activeEvents.isLoading || services.isLoading || requests.isLoading;

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
              void Promise.all([requests.refetch(), activeEvents.refetch(), services.refetch()]);
            }}
          />
        }
      >
        <View className="mx-auto w-full max-w-[672px] gap-5">
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
                {requestsForEvent.length}
              </Text>
              <Text className="mt-1 text-sm text-primary-foreground/80">
                {requestsForEvent.length === 1 ? "solicitud capturada" : "solicitudes capturadas"}
              </Text>
            </View>
          ) : null}

          {loading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#981646" />
              <Text className="mt-3 text-muted-foreground">Cargando solicitudes...</Text>
            </View>
          ) : activeEvents.error || requests.error ? (
            <View className="rounded-2xl border border-destructive/30 bg-card p-5">
              <Text className="font-semibold text-destructive">
                No fue posible cargar tus solicitudes.
              </Text>
              <Button className="mt-4" onPress={() => requests.refetch()}>
                <Text>Reintentar</Text>
              </Button>
            </View>
          ) : !activeEvents.data?.length ? (
            <View className="items-center rounded-2xl border border-border bg-card px-5 py-12">
              <Text className="text-lg font-bold">No hay eventos activos</Text>
              <Text className="mt-2 text-center text-muted-foreground">
                Cuando exista un evento activo podrás consultar aquí tus capturas.
              </Text>
            </View>
          ) : requestsForEvent.length ? (
            <View className="gap-3">
              <Text className="text-lg font-bold">Solicitudes capturadas</Text>
              {requestsForEvent.map((request) => (
                <View key={request.id} className="rounded-2xl border border-border bg-card p-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="font-bold text-primary">{request.folio}</Text>
                      <Text className="mt-1 font-semibold">
                        {serviceNames[request.serviceId] || "Trámite no disponible"}
                      </Text>
                    </View>
                    <Text className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
                      {request.status.replaceAll("_", " ")}
                    </Text>
                  </View>
                  <View className="mt-3 flex-row items-center justify-between gap-3">
                    <Text className="text-xs text-muted-foreground">
                      {new Date(request.requestedAt).toLocaleString("es-MX")}
                    </Text>
                    {request.priorityOnReopening ? (
                      <Text className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                        Prioritaria
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="items-center rounded-2xl border border-border bg-card px-5 py-12">
              <Text className="text-lg font-bold">Sin capturas en este evento</Text>
              <Text className="mt-2 text-center text-muted-foreground">
                Las solicitudes que registres aparecerán aquí.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
