import { Button } from "@/src/components/ui/button";
import { THEME } from "@/src/components/ui/lib/theme";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Text } from "@/src/components/ui/text";
import { useGetJornadasDelDia } from "@/src/hooks";
import { useActiveEvents, useServicesCatalog } from "@/src/hooks/useCatalog";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { requestsService } from "@/src/services/requests";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MisSolicitudesScreen() {
  const { user } = useAuth();
  const { colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const primaryColor = THEME[colorScheme].primary;
  const primaryForegroundColor = THEME[colorScheme].primaryForeground;
  const backgroundColor = THEME[colorScheme].background;
  const foregroundColor = THEME[colorScheme].foreground;
  const borderColor = THEME[colorScheme].border;
  const mutedForegroundColor = THEME[colorScheme].mutedForeground;
  const opacity = colorScheme === "dark" ? 0.1 : 0.05;
  const [selectedEventId, setSelectedEventId] = useState("");
  const activeEvents = useActiveEvents();
  const services = useServicesCatalog();
  const capturistaRequests = useQuery({
    queryKey: ["capturista", "requests", user?.id],
    queryFn: () => requestsService.listByCapturista(user!.id),
    enabled: user?.role === "capturista" && Boolean(user?.id),
  });

  const effectiveEventId =
    selectedEventId &&
      activeEvents.data?.some((event) => event.id === selectedEventId)
      ? selectedEventId
      : activeEvents.data?.[0]?.id || "";
  const selectedEvent = activeEvents.data?.find(
    (event) => event.id === effectiveEventId,
  );
  const serviceNames = useMemo(
    () =>
      Object.fromEntries(
        (services.data || []).map((service) => [service.id, service.name]),
      ),
    [services.data],
  );
  const requestsForEvent = useMemo(
    () =>
      (capturistaRequests.data || []).filter(
        (request) => request.eventId === effectiveEventId,
      ),
    [capturistaRequests.data, effectiveEventId],
  );

  // Verificar si el usuario tiene los labels "secretaria" o "titular"
  const isSecretariaOrTitular = useMemo(() => {
    return user?.labels?.some(
      (label) =>
        label.toLowerCase() === "secretaria" ||
        label.toLowerCase() === "titular"
    );
  }, [user?.labels]);

  // Si es secretaria o titular, obtener todas las jornadas del día. Si no, solo las del usuario.
  const {
    data: jornadasData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useGetJornadasDelDia(
    !isSecretariaOrTitular,
    user?.role !== "capturista",
  );

  // Asegurar que jornadas siempre sea un array
  const jornadas = Array.isArray(jornadasData) ? jornadasData : [];

  if (user?.role === "capturista") {
    const loading =
      activeEvents.isLoading || services.isLoading || capturistaRequests.isLoading;

    return (
      <View className="flex-1 bg-background">
        <View
          className="border-b border-border bg-background px-6 pb-5"
          style={{ paddingTop: insets.top + 16 }}
        >
          <Text className="text-center text-xl font-bold">Mis solicitudes</Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">
            Consulta tus capturas por jornada activa.
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
              refreshing={capturistaRequests.isRefetching}
              onRefresh={() => {
                void Promise.all([
                  capturistaRequests.refetch(),
                  activeEvents.refetch(),
                  services.refetch(),
                ]);
              }}
            />
          }
        >
          <View className="mx-auto w-full max-w-[672px] gap-5">
            {activeEvents.data?.length ? (
              <View className="gap-3">
                <Text className="font-semibold">Selecciona una jornada</Text>
                <Select
                  value={
                    selectedEvent
                      ? { label: selectedEvent.name, value: selectedEvent.id }
                      : undefined
                  }
                  onValueChange={(option) => {
                    if (option?.value) setSelectedEventId(option.value);
                  }}
                >
                  <SelectTrigger className="h-12 w-full rounded-xl px-4">
                    <SelectValue placeholder="Selecciona una jornada activa" />
                  </SelectTrigger>
                  <SelectContent
                    insets={{
                      top: insets.top,
                      bottom: insets.bottom,
                      left: 16,
                      right: 16,
                    }}
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
                <Text className="text-sm text-primary-foreground/80">
                  Capturas realizadas en
                </Text>
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
                <ActivityIndicator color={primaryColor} />
                <Text className="mt-3 text-muted-foreground">Cargando capturas...</Text>
              </View>
            ) : activeEvents.error || capturistaRequests.error ? (
              <View className="rounded-2xl border border-destructive/30 bg-card p-5">
                <Text className="font-semibold text-destructive">
                  No fue posible cargar tus solicitudes.
                </Text>
                <Button className="mt-4" onPress={() => capturistaRequests.refetch()}>
                  <Text>Reintentar</Text>
                </Button>
              </View>
            ) : !activeEvents.data?.length ? (
              <View className="items-center rounded-2xl border border-border bg-card px-5 py-12">
                <Text className="text-lg font-bold">No hay jornadas activas</Text>
                <Text className="mt-2 text-center text-muted-foreground">
                  Cuando exista una jornada activa podrás consultar aquí tus capturas.
                </Text>
              </View>
            ) : requestsForEvent.length ? (
              <View className="gap-3">
                <Text className="text-lg font-bold">Solicitudes capturadas</Text>
                {requestsForEvent.map((request) => (
                  <View
                    key={request.id}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
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
                    <Text className="mt-3 text-xs text-muted-foreground">
                      {new Date(request.requestedAt).toLocaleTimeString("es-MX")}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center rounded-2xl border border-border bg-card px-5 py-12">
                <Text className="text-lg font-bold">Sin capturas en esta jornada</Text>
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

  return (
    <View className="flex-1 bg-background" style={{ position: "relative" }}>
      {/* Formas decorativas orgánicas de fondo */}
      <View
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 350,
          height: 380,
          borderRadius: 200,
          borderTopLeftRadius: 50,
          borderBottomRightRadius: 250,
          backgroundColor: primaryColor,
          opacity,
          transform: [{ rotate: "-15deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 150,
          right: -120,
          width: 450,
          height: 420,
          borderRadius: 250,
          borderTopLeftRadius: 150,
          borderBottomRightRadius: 300,
          backgroundColor: primaryColor,
          opacity: opacity * 0.7,
          transform: [{ rotate: "20deg" }],
        }}
      />

      <View
        className="px-6 pb-4 gap-2 bg-transparent flex"
        style={{
          paddingTop: insets.top + 12,
        }}
      >
        <View className="items-center">
          <Text
            className="text-lg font-bold"
            style={{ color: foregroundColor }}
          >
            Mis Solicitudes
          </Text>
          <Text
            className="text-md text-center mb-3"
            style={{ color: mutedForegroundColor }}
          >
            {isSecretariaOrTitular
              ? "Todos los registros de jornadas"
              : "Mis registros de jornadas"}
          </Text>
          {/* Contador de registros */}
          {!isLoading && (
            <View
              className="px-4 py-2 rounded-full mt-2"
              style={{
                backgroundColor:
                  colorScheme === "dark"
                    ? `${primaryColor}30`
                    : `${primaryColor}15`,
                borderWidth: 1,
                borderColor: primaryColor,
              }}
            >
              <Text className="text-base font-semibold text-white">
                {jornadas.length} registro{jornadas.length !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
          {isLoading && (
            <View className="mt-2">
              <Text className="text-sm" style={{ color: mutedForegroundColor }}>
                Cargando...
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6 pb-6 bg-transparent"
        showsVerticalScrollIndicator={false}
        style={{ zIndex: 1 }}
        contentContainerStyle={{
          paddingBottom: Platform.OS !== "web" ? insets.bottom + 16 : undefined,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <View className="gap-4 w-full max-w-[672px] mx-auto">
          {isLoading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color={primaryColor} />
              <Text
                className="text-base mt-4"
                style={{ color: mutedForegroundColor }}
              >
                Cargando registros...
              </Text>
            </View>
          ) : error ? (
            <View className="items-center justify-center py-12">
              <Text className="text-lg mb-4" style={{ color: foregroundColor }}>
                Error al cargar los registros
              </Text>
              <Text
                className="text-base text-center mb-6"
                style={{ color: mutedForegroundColor }}
              >
                {error instanceof Error
                  ? error.message
                  : "No se pudieron cargar los registros"}
              </Text>
              <Button onPress={() => refetch()}>
                <Text>Reintentar</Text>
              </Button>
            </View>
          ) : !Array.isArray(jornadas) || jornadas.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text className="text-lg mb-2" style={{ color: foregroundColor }}>
                No hay registros
              </Text>
              <Text
                className="text-base text-center"
                style={{ color: mutedForegroundColor }}
              >
                {isSecretariaOrTitular
                  ? "Aún no se han registrado jornadas."
                  : "Aún no has registrado jornadas."}
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {/* Tabla */}
              <View
                className="rounded-lg border overflow-hidden"
                style={{
                  backgroundColor,
                  borderColor,
                }}
              >
                {/* Encabezados de la tabla */}
                <View
                  className="flex-row border-b"
                  style={{
                    backgroundColor: `${primaryColor}10`,
                    borderBottomColor: borderColor,
                  }}
                >
                  <View
                    className="p-3 border-r"
                    style={{
                      flex: 1.2,
                      borderRightColor: borderColor,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: primaryForegroundColor }}
                    >
                      Nombre
                    </Text>
                  </View>
                  <View
                    className="p-3 border-r"
                    style={{
                      flex: 1.2,
                      borderRightColor: borderColor,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: primaryForegroundColor }}
                    >
                      Primer apellido
                    </Text>
                  </View>
                  <View
                    className="p-3 border-r"
                    style={{
                      flex: 1.2,
                      borderRightColor: borderColor,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: primaryForegroundColor }}
                    >
                      Segundo apellido
                    </Text>
                  </View>
                  <View
                    className="p-3"
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: primaryForegroundColor }}
                    >
                      CURP
                    </Text>
                  </View>
                </View>

                {/* Filas de datos */}
                {Array.isArray(jornadas) &&
                  jornadas.map((jornada, index) => (
                    <View
                      key={jornada.id || index}
                      className={`flex-row ${index < jornadas.length - 1 ? "border-b" : ""
                        }`}
                      style={{
                        borderBottomColor:
                          index < jornadas.length - 1
                            ? borderColor
                            : "transparent",
                      }}
                    >
                      <View
                        className="p-3 border-r"
                        style={{
                          flex: 1.2,
                          borderRightColor: borderColor,
                        }}
                      >
                        <Text
                          className="text-sm"
                          style={{ color: foregroundColor }}
                        >
                          {jornada.nombreSolicitante || "N/A"}
                        </Text>
                      </View>
                      <View
                        className="p-3 border-r"
                        style={{
                          flex: 1.2,
                          borderRightColor: borderColor,
                        }}
                      >
                        <Text
                          className="text-sm"
                          style={{ color: foregroundColor }}
                        >
                          {jornada.primerApellido || "N/A"}
                        </Text>
                      </View>
                      <View
                        className="p-3 border-r"
                        style={{
                          flex: 1.2,
                          borderRightColor: borderColor,
                        }}
                      >
                        <Text
                          className="text-sm"
                          style={{ color: foregroundColor }}
                        >
                          {jornada.segundoApellido || "-"}
                        </Text>
                      </View>
                      <View
                        className="p-3"
                        style={{
                          flex: 1,
                        }}
                      >
                        <Text
                          className="text-sm"
                          style={{ color: foregroundColor }}
                        >
                          {jornada.curp || "N/A"}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
