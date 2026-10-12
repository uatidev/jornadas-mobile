import { HomeHeader, ServiceCard, getServiceStatus } from "@/src/components/modules/home";
import { useActiveEvents, useServicesCatalog } from "@/src/hooks/useCatalog";
import { useNewRequest } from "@/src/hooks/useHome";
import { setSelectedEventId as shareSelectedEventId } from "@/src/hooks/useSelectedEvent";
import { useAuth } from "@/src/providers/AuthProvider";
import { identityApi } from "@/src/services/identityApi";
import type { AttentionEvent, ServiceType } from "@/src/types/catalog";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { GlassInput } from "@/src/components/common/GlassInput";
import { useGlassTabBarSpace } from "@/src/components/common/GlassTabBar";

const TYPE_FILTERS: { value: ServiceType | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "tramite", label: "Trámites" },
  { value: "servicio", label: "Servicios" },
  { value: "programa", label: "Programas" },
];

const distanceInKm = (
  latitude: number,
  longitude: number,
  event: AttentionEvent,
) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(event.latitude - latitude);
  const longitudeDelta = toRadians(event.longitude - longitude);
  const originLatitude = toRadians(latitude);
  const eventLatitude = toRadians(event.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
    Math.cos(eventLatitude) *
    Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function HomeScreen() {
  const { handleLogout, handleNavigate } = useNewRequest();
  const { user } = useAuth();
  const router = useRouter();
  const tabBarSpace = useGlassTabBarSpace();
  const { data: services = [], isLoading, error, refetch } = useServicesCatalog();
  const { data: events = [], refetch: refetchEvents } = useActiveEvents();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ServiceType | "todos">("todos");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [renderedAt] = useState(() => Date.now());
  const autoSelectionStarted = useRef(false);
  const manuallySelected = useRef(false);
  const popularity = useQuery({
    queryKey: ["catalog", "service-popularity"],
    queryFn: identityApi.getServicePopularity,
    enabled: Boolean(user?.role),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!events.length || autoSelectionStarted.current) return;
    autoSelectionStarted.current = true;

    let cancelled = false;
    const selectClosestEvent = async () => {
      let closestEvent = events[0];
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const eventsWithCoordinates = events.filter(
            (event) =>
              Number.isFinite(event.latitude) &&
              Number.isFinite(event.longitude),
          );

          if (eventsWithCoordinates.length) {
            closestEvent = eventsWithCoordinates.reduce((closest, event) =>
              distanceInKm(
                location.coords.latitude,
                location.coords.longitude,
                event,
              ) <
                distanceInKm(
                  location.coords.latitude,
                  location.coords.longitude,
                  closest,
                )
                ? event
                : closest,
            );
          }
        }
      } catch (error) {
        console.warn("No fue posible seleccionar el evento más cercano:", error);
      }

      if (!cancelled && !manuallySelected.current) {
        setSelectedEventId(closestEvent.id);
      }
    };

    void selectClosestEvent();
    return () => {
      cancelled = true;
    };
  }, [events]);

  // Comparte el evento elegido (p. ej. con Atención de Secretaría).
  useEffect(() => {
    if (selectedEventId) shareSelectedEventId(selectedEventId);
  }, [selectedEventId]);

  const handleEventChange = (eventId: string) => {
    manuallySelected.current = true;
    setSelectedEventId(eventId);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetch(), refetchEvents(), popularity.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const normalizedSearch = search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visibleServices = [...services]
    .filter((service) => typeFilter === "todos" || service.type === typeFilter)
    .filter((service) => !normalizedSearch || `${service.name} ${service.description}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalizedSearch))
    .sort((first, second) => (popularity.data?.counts[second.id] || 0) - (popularity.data?.counts[first.id] || 0));

  return (
    <View className="flex-1 bg-background">
      <HomeHeader
        onLogout={handleLogout}
        events={events}
        selectedEventId={selectedEventId}
        onEventChange={handleEventChange}
      />

      <View className="px-6 py-2 flex-col gap-2">

        <GlassInput
          leftIcon="ci:search-magnifying-glass"
          returnKeyType="search"
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar trámite, programa o servicio"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TYPE_FILTERS.map((filter) => {
            const selected = typeFilter === filter.value;
            return (
              <Pressable
                key={filter.value}
                onPress={() => setTypeFilter(filter.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{ paddingInline: 10 }}
                className={`h-8 flex-row items-center gap-1.5 rounded-full border ${selected ? "border-primary bg-primary" : "border-border bg-card"}`}
              >
                <Text className={`font-sans text-xs font-semibold ${selected ? "text-white" : "text-muted-foreground"}`}>{filter.label}</Text>
                {/* Cantidad de resultados del filtro activo (incluye la búsqueda). */}
                {selected && !isLoading ? (
                  <View className="min-w-5 items-center rounded-full bg-white/25 px-1.5">
                    <Text className="font-sans text-[11px] font-bold text-white">{visibleServices.length}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        {/* Catálogo de trámites */}
        {/* <Text className="font-sans text-xs text-muted-foreground">Ordenados del más solicitado al menos solicitado.</Text> */}
      </View>


      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: tabBarSpace + 20, paddingTop: 5 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#981646"
            colors={["#981646"]}
          />
        }
      >
        {Platform.OS === "web" && (user?.role === "super_admin" || user?.role === "enlace") && (
          <Pressable onPress={() => router.push("/admin" as any)} className="mb-2 rounded-2xl bg-primary p-5 active:opacity-80">
            <Text className="font-sans text-lg font-bold text-primary-foreground">Abrir panel administrativo</Text>
            <Text className="font-sans mt-1 text-primary-foreground/80">Consulta las solicitudes asignadas a tu unidad.</Text>
          </Pressable>
        )}

        {!events.length && (
          <View className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950">
            <Text className="font-sans font-bold text-amber-900 dark:text-amber-200">No hay un evento activo</Text>
            <Text className="font-sans mt-1 text-sm text-amber-800 dark:text-amber-300">Es necesario crear o activar un evento para registrar solicitudes.</Text>
          </View>
        )}


        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#981646" />
            <Text className="font-sans mt-3 text-muted-foreground">Cargando trámites y servicios...</Text>
          </View>
        ) : error ? (
          <Pressable onPress={() => refetch()} className="rounded-2xl border border-destructive/30 bg-card p-6">
            <Text className="font-sans font-semibold text-destructive">No fue posible cargar el catálogo</Text>
            <Text className="font-sans mt-2 text-muted-foreground">Toca para volver a intentar.</Text>
          </Pressable>
        ) : (
          <View>
            <View>
              {visibleServices.map((service) => {
                const status = getServiceStatus(service, renderedAt);
                return (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    status={status}
                    disabled={!selectedEventId}
                    onPress={() => handleNavigate({ id: service.id, title: service.name, subtitle: service.description, estado: status === "open" }, selectedEventId)}
                  />
                );
              })}
            </View>
            {!visibleServices.length ? (
              <View className="rounded-2xl border border-border bg-card p-8">
                <Text className="font-sans text-center font-semibold">No encontramos trámites con ese nombre.</Text>
                <Pressable onPress={() => { setSearch(""); setTypeFilter("todos"); }}><Text className="font-sans mt-2 text-center text-primary">Limpiar filtros</Text></Pressable>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
