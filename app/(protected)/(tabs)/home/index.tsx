import { HomeHeader } from "@/src/components/modules/home";
import { useActiveEvents, useServicesCatalog } from "@/src/hooks/useCatalog";
import { useNewRequest } from "@/src/hooks/useHome";
import { useAuth } from "@/src/providers/AuthProvider";
import type { AttentionEvent } from "@/src/types/catalog";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

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
  const { data: services = [], isLoading, error, refetch } = useServicesCatalog();
  const { data: events = [], refetch: refetchEvents } = useActiveEvents();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");
  const autoSelectionStarted = useRef(false);
  const manuallySelected = useRef(false);

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

  const handleEventChange = (eventId: string) => {
    manuallySelected.current = true;
    setSelectedEventId(eventId);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetch(), refetchEvents()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const serviceIsOpen = (service: (typeof services)[number]) => {
    const now = Date.now();
    return service.active &&
      (!service.opensAt || now >= new Date(service.opensAt).getTime()) &&
      (!service.closesAt || now <= new Date(service.closesAt).getTime());
  };

  return (
    <View className="flex-1 bg-background">
      <HomeHeader
        onLogout={handleLogout}
        events={events}
        selectedEventId={selectedEventId}
        onEventChange={handleEventChange}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20, paddingTop: 5 }}
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
            <Text className="text-lg font-bold text-primary-foreground">Abrir panel administrativo</Text>
            <Text className="mt-1 text-primary-foreground/80">Consulta las solicitudes asignadas a tu unidad.</Text>
          </Pressable>
        )}

        {!events.length && (
          <View className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <Text className="font-bold text-amber-900">No hay un evento activo</Text>
            <Text className="mt-1 text-sm text-amber-800">Es necesario crear o activar un evento para registrar solicitudes.</Text>
          </View>
        )}

        {/* Catálogo de trámites */}
        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#981646" />
            <Text className="mt-3 text-muted-foreground">Cargando trámites y servicios...</Text>
          </View>
        ) : error ? (
          <Pressable onPress={() => refetch()} className="rounded-2xl border border-destructive/30 bg-card p-6">
            <Text className="font-semibold text-destructive">No fue posible cargar el catálogo</Text>
            <Text className="mt-2 text-muted-foreground">Toca para volver a intentar.</Text>
          </Pressable>
        ) : (
          <View>
            <Text className="mb-3 text-lg font-bold">Trámites y servicios</Text>
            <View className="flex-row flex-wrap justify-between">
              {services.map((service, index) => {
                const open = serviceIsOpen(service);
                return (
                  <Pressable
                    key={service.id}
                    className="mb-4 min-h-36 w-[48%] justify-between rounded-2xl border border-border bg-card p-4 active:opacity-70"
                    disabled={!selectedEventId}
                    onPress={() => handleNavigate({ id: service.id, title: service.name, subtitle: service.description, estado: open }, selectedEventId)}
                  >
                    <View className="flex-row items-center justify-between">
                      <View
                        className="h-10 w-10 items-center justify-center rounded-full"
                        style={{ backgroundColor: "#98164620" }}
                      >
                        <Text className="font-bold" style={{ color: "#981646" }}>
                          {String(index + 1).padStart(2, "0")}
                        </Text>
                      </View>
                      <Text className="text-xs font-semibold" style={{ color: open ? "#981646" : "#b45309" }}>
                        {open ? "Abierto" : service.opensAt && new Date(service.opensAt).getTime() > Date.now() ? `Abre ${new Date(service.opensAt).toLocaleDateString("es-MX")}` : "Cerrado · acepta prioridad"}
                      </Text>
                    </View>

                    <View className="mt-5 flex-row items-end justify-between">
                      <Text className="mr-2 flex-1 text-base font-semibold text-card-foreground">
                        {service.name}
                      </Text>
                      <ChevronRight color="#981646" size={19} strokeWidth={2.5} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
