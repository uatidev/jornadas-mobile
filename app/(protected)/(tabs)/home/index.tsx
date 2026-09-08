import { HomeHeader } from "@/src/components/modules/home";
import { useActiveEvents, useServicesCatalog } from "@/src/hooks/useCatalog";
import { useNewRequest } from "@/src/hooks/useHome";
import { useAuth } from "@/src/providers/AuthProvider";
import type { AttentionEvent } from "@/src/types/catalog";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

const DEFAULT_SERVICE_IMAGE = require("@/src/assets/images/logo-turismo.png");

function ServiceCardImage({ imageUrl }: { imageUrl?: string }) {
  const [hasError, setHasError] = useState(false);

  return (
    <Image
      source={imageUrl && !hasError ? { uri: imageUrl } : DEFAULT_SERVICE_IMAGE}
      resizeMode={imageUrl && !hasError ? "cover" : "contain"}
      style={[StyleSheet.absoluteFill, { backgroundColor: "#ffffff" }]}
      onError={() => setHasError(true)}
    />
  );
}

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
  const [renderedAt] = useState(() => Date.now());
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
    const now = renderedAt;
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
                const opensLater = Boolean(
                  service.opensAt &&
                    new Date(service.opensAt).getTime() > renderedAt,
                );
                return (
                  <Pressable
                    key={service.id}
                    className="relative mb-4 min-h-40 w-full justify-between overflow-hidden rounded-2xl border border-border bg-primary p-3 active:opacity-70 sm:w-[48%]"
                    disabled={!selectedEventId}
                    onPress={() => handleNavigate({ id: service.id, title: service.name, subtitle: service.description, estado: open }, selectedEventId)}
                  >
                    <ServiceCardImage
                      key={service.imageUrl || "default"}
                      imageUrl={service.imageUrl}
                    />
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: service.imageUrl
                            ? "rgba(0, 0, 0, 0.58)"
                            : "rgba(0, 0, 0, 0.28)",
                        },
                      ]}
                    />
                    <View className="flex-row items-center justify-between">
                      <View
                        className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
                      >
                        <Text className="font-bold" style={{ color: "#981646" }}>
                          {String(index + 1).padStart(2, "0")}
                        </Text>
                      </View>
                      <View
                        className="max-w-[68%] items-center rounded-xl px-3 py-1.5"
                        style={{
                          backgroundColor: open ? "rgba(255,255,255,0.92)" : "rgba(254,243,199,0.95)",
                        }}
                      >
                        <Text
                          className="text-center text-xs font-bold"
                          style={{ color: open ? "#981646" : "#92400e" }}
                        >
                          {open ? "Abierto" : opensLater ? "Abre el" : "Cerrado"}
                        </Text>
                        {!open ? (
                          <Text
                            className="mt-0.5 text-center text-[10px] leading-3"
                            style={{ color: "#92400e" }}
                          >
                            {opensLater
                              ? new Date(service.opensAt!).toLocaleDateString("es-MX")
                              : "Acepta prioridad"}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <View className="mt-5 flex-row items-end justify-between">
                      <Text className="mr-2 flex-1 text-base font-semibold text-white">
                        {service.name}
                      </Text>
                      <ChevronRight color="#ffffff" size={19} strokeWidth={2.5} />
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
