"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import { useActiveEvents, useServicesCatalog } from "@/src/hooks/useCatalog";
import { useNewRequest } from "@/src/hooks/useHome";
import { useAuth } from "@/src/providers/AuthProvider";
import type { ProcedureService } from "@/src/types/catalog";
import { useRouter } from "expo-router";
import Monicon from "@monicon/native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";

const DEFAULT_SERVICE_IMAGE = require("@/src/assets/images/logo-turismo.png");

const getAvailability = (service: ProcedureService) => {
  const now = Date.now();
  const opensAt = service.opensAt ? new Date(service.opensAt).getTime() : null;
  const closesAt = service.closesAt ? new Date(service.closesAt).getTime() : null;

  if (!service.active) return { open: false, label: "Inactivo" };
  if (opensAt && now < opensAt) {
    return {
      open: false,
      label: `Abre ${new Date(service.opensAt!).toLocaleDateString("es-MX")}`,
    };
  }
  if (closesAt && now > closesAt) {
    return { open: false, label: "Cerrado · acepta prioridad" };
  }
  return { open: true, label: "Disponible" };
};

export default function CapturistaWebDashboard() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const compact = width < 900;
  const { user } = useAuth();
  const { handleLogout, handleNavigate } = useNewRequest();
  const services = useServicesCatalog();
  const events = useActiveEvents();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [search, setSearch] = useState("");

  const activeEventId =
    selectedEventId && events.data?.some((event) => event.id === selectedEventId)
      ? selectedEventId
      : events.data?.[0]?.id || "";
  const activeEvent = events.data?.find((event) => event.id === activeEventId);
  const filteredServices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-MX");
    if (!query) return services.data || [];
    return (services.data || []).filter((service) =>
      [service.name, service.code, service.description, service.type].some((value) =>
        value?.toLocaleLowerCase("es-MX").includes(query),
      ),
    );
  }, [search, services.data]);

  const startRequest = (service: ProcedureService) => {
    const availability = getAvailability(service);
    handleNavigate(
      {
        id: service.id,
        title: service.name,
        subtitle: service.description,
        estado: availability.open,
      },
      activeEventId,
    );
  };

  return (
    <View className="h-screen flex-row bg-muted/30">
      {!compact ? (
        <View className="w-72 border-r border-border bg-card p-6">
          <View className="border-b border-border pb-6">
            <Text className="text-2xl font-bold text-primary">Jornadas</Text>
            <Text className="mt-1 text-sm text-muted-foreground">Panel de captura</Text>
          </View>

          <View className="mt-7 flex-row items-center gap-3 rounded-xl bg-primary px-4 py-3">
            <Monicon name="ci:note-edit" size={20} color="#ffffff" />
            <View>
              <Text className="font-semibold text-primary-foreground">Trámites y servicios</Text>
              <Text className="mt-1 text-xs text-primary-foreground/80">Nueva solicitud</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/(protected)/(tabs)/mis-solicitudes" as any)}
            className="mt-2 flex-row items-center gap-3 rounded-xl px-4 py-3 hover:bg-muted"
          >
            <Monicon name="ci:file-document" size={20} color="#71717a" />
            <View>
              <Text className="font-semibold">Mis solicitudes</Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                Capturas por jornada
              </Text>
            </View>
          </Pressable>
          {(user?.role === "secretaria" || user?.role === "capturista_secretaria" || user?.role === "enlace" || user?.role === "gestor") ? (
            <Pressable onPress={() => router.push("/secretary-requests" as any)} className="mt-2 flex-row items-center gap-3 rounded-xl px-4 py-3 hover:bg-muted">
              <Monicon name="ci:file-document" size={20} color="#92400e" />
              <View><Text className="font-semibold">Atención de Secretaria</Text><Text className="mt-1 text-xs text-muted-foreground">Oficios prioritarios</Text></View>
            </Pressable>
          ) : null}

          <View className="mt-auto border-t border-border pt-5">
            <Text className="font-semibold">{user?.nombre}</Text>
            <Text className="mb-4 mt-1 text-xs text-muted-foreground">
              Rol: {user?.role === "super_admin"
                ? "Superadministrador"
                : user?.role === "secretaria"
                  ? "Secretaria"
                  : user?.role === "capturista_secretaria"
                    ? "Representante de la Titular"
                  : user?.role === "enlace"
                    ? "Enlace de canalización"
                    : user?.role === "gestor"
                      ? "Gestor"
                      : user?.role === "capturista"
                        ? "Capturista"
                        : "Usuario"}
            </Text>
            <Button variant="outline" onPress={handleLogout}>
              <Text>Cerrar sesión</Text>
            </Button>
          </View>
        </View>
      ) : null}

      <View className="flex-1 overflow-hidden">
        <View className="border-b border-border bg-background px-6 py-5 lg:px-8">
          <View className="mx-auto w-full max-w-7xl flex-row items-center justify-between gap-4">
            <View className="flex-1">
              <Text className="text-2xl font-bold">Nueva captura</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Selecciona un trámite para registrar una solicitud.
              </Text>
            </View>
            {compact ? (
              <Button variant="outline" onPress={handleLogout}>
                <Text>Salir</Text>
              </Button>
            ) : null}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: compact ? 20 : 32 }}>
          <View className="mx-auto w-full max-w-7xl gap-6">
            <View className={`gap-4 ${compact ? "" : "flex-row"}`}>
              <View className="flex-1 rounded-2xl border border-border bg-card p-5">
                <Text className="text-xs font-bold uppercase text-muted-foreground">Jornada activa</Text>
                {events.isLoading ? (
                  <ActivityIndicator className="mt-4 self-start" color="#981646" />
                ) : events.data?.length ? (
                  <select
                    aria-label="Jornada activa"
                    value={activeEventId}
                    onChange={(event) => setSelectedEventId(event.currentTarget.value)}
                    style={{
                      width: "100%",
                      minHeight: 42,
                      marginTop: 12,
                      padding: "0 12px",
                      borderRadius: 8,
                      border: "1px solid #d4d4d8",
                      background: "transparent",
                    }}
                  >
                    {events.data.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name} · {event.municipality}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Text className="mt-2 font-semibold text-amber-700">No hay jornadas activas</Text>
                )}
                {activeEvent ? (
                  <Text className="mt-2 text-xs text-muted-foreground">
                    {activeEvent.venue} · {activeEvent.locality}
                  </Text>
                ) : null}
              </View>

              <View className="flex-1 rounded-2xl border border-border bg-card p-5">
                <Text className="text-xs font-bold uppercase text-muted-foreground">Trámites disponibles</Text>
                <Text className="mt-2 text-3xl font-bold text-primary">{services.data?.length || 0}</Text>
                <Text className="mt-1 text-sm text-muted-foreground">Catálogo habilitado para captura</Text>
              </View>
            </View>

            {!events.isLoading && !events.data?.length ? (
              <View className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
                <Text className="font-bold text-amber-900">No es posible iniciar una captura</Text>
                <Text className="mt-1 text-sm text-amber-800">
                  Un administrador debe crear o activar una jornada de atención.
                </Text>
              </View>
            ) : null}

            <View className="rounded-2xl border border-border bg-card p-5">
              <View className={`gap-4 ${compact ? "" : "flex-row items-center justify-between"}`}>
                <View>
                  <Text className="text-xl font-bold">Trámites y servicios</Text>
                  <Text className="mt-1 text-sm text-muted-foreground">
                    Busca por nombre, clave, descripción o tipo.
                  </Text>
                </View>
                <Input
                  aria-label="Buscar trámite"
                  className={compact ? "w-full" : "w-96"}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar trámite..."
                />
              </View>

              {services.isLoading ? (
                <View className="items-center py-16">
                  <ActivityIndicator color="#981646" />
                  <Text className="mt-3 text-muted-foreground">Cargando catálogo...</Text>
                </View>
              ) : services.error ? (
                <Pressable onPress={() => services.refetch()} className="mt-5 rounded-xl border border-destructive/30 p-5">
                  <Text className="font-semibold text-destructive">No fue posible cargar el catálogo.</Text>
                  <Text className="mt-1 text-sm text-muted-foreground">Haz clic para volver a intentar.</Text>
                </Pressable>
              ) : (
                <View className="mt-5 overflow-hidden rounded-xl border border-border">
                  {!compact ? (
                    <View className="grid grid-cols-[120px_1fr_150px_180px] items-center gap-4 bg-muted px-5 py-3">
                      <Text className="text-xs font-bold text-muted-foreground">CLAVE</Text>
                      <Text className="text-xs font-bold text-muted-foreground">TRÁMITE O SERVICIO</Text>
                      <Text className="text-xs font-bold text-muted-foreground">ESTATUS</Text>
                      <Text className="text-xs font-bold text-muted-foreground">ACCIÓN</Text>
                    </View>
                  ) : null}

                  {filteredServices.map((service) => {
                    const availability = getAvailability(service);
                    return (
                      <View
                        key={service.id}
                        className={`${compact ? "gap-3" : "grid grid-cols-[120px_1fr_150px_180px] items-center gap-4"} border-t border-border px-5 py-4 first:border-t-0`}
                      >
                        <Text className="text-sm font-bold text-primary">{service.code}</Text>
                        <View className="flex-row items-center gap-3">
                          <Image
                            source={
                              service.imageUrl
                                ? { uri: service.imageUrl }
                                : DEFAULT_SERVICE_IMAGE
                            }
                            resizeMode={service.imageUrl ? "cover" : "contain"}
                            className="h-14 w-20 rounded-lg bg-white"
                          />
                          <View className="flex-1">
                            <Text className="font-semibold">{service.name}</Text>
                            <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
                              {service.description}
                            </Text>
                          </View>
                        </View>
                        <Text className={availability.open ? "text-sm font-semibold text-green-700" : "text-sm font-semibold text-amber-700"}>
                          {availability.label}
                        </Text>
                        <Button disabled={!activeEventId} onPress={() => startRequest(service)}>
                          <Text>{availability.open ? "Capturar solicitud" : "Capturar con prioridad"}</Text>
                        </Button>
                      </View>
                    );
                  })}

                  {!filteredServices.length ? (
                    <Text className="p-10 text-center text-muted-foreground">
                      No hay trámites que coincidan con la búsqueda.
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
