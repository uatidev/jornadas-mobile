import { HomeHeader } from "@/src/components/modules/home";
import { Input } from "@/src/components/ui/input";
import { useActiveEvents, useServicesCatalog } from "@/src/hooks/useCatalog";
import { useNewRequest } from "@/src/hooks/useHome";
import { useAuth } from "@/src/providers/AuthProvider";
import { identityApi } from "@/src/services/identityApi";
import type { AttentionEvent } from "@/src/types/catalog";
import { useQuery } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Building2, ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function ServiceCardImage({ imageUrl }: { imageUrl?: string }) {
  const [hasError, setHasError] = useState(false);
  const showsUploadedImage = Boolean(imageUrl && !hasError);

  if (!showsUploadedImage) {
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.defaultServiceBackground,
        ]}
      >
        <View style={styles.defaultServiceAccent} />
        <View style={styles.defaultServiceSurface} />
        <View style={styles.defaultServiceWatermark}>
          <Building2 color="rgba(255,255,255,0.13)" size={82} strokeWidth={1.25} />
        </View>
        <View style={styles.defaultServiceInstitution}>
          <View style={styles.defaultServiceSeal}>
            <Building2 color="#d8b46a" size={17} strokeWidth={1.8} />
          </View>
          <View>
            <Text style={styles.defaultServiceInstitutionTitle}>SERVICIO INSTITUCIONAL</Text>
            <Text style={styles.defaultServiceInstitutionSubtitle}>SECRETARÍA DE TURISMO</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      <Image
        source={{ uri: imageUrl }}
        resizeMode="contain"
        style={[StyleSheet.absoluteFill, { backgroundColor: "#ffffff" }]}
        onError={() => setHasError(true)}
      />
      <BlurView
        pointerEvents="none"
        intensity={5}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.uploadedImageShade]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  uploadedImageShade: {
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  defaultServiceBackground: {
    backgroundColor: "#741433",
  },
  defaultServiceAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "#d8b46a",
  },
  defaultServiceSurface: {
    position: "absolute",
    top: 4,
    bottom: 0,
    left: 4,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  defaultServiceWatermark: {
    position: "absolute",
    right: 15,
    bottom: 8,
  },
  defaultServiceInstitution: {
    position: "absolute",
    left: 14,
    top: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    opacity: 0.82,
  },
  defaultServiceSeal: {
    width: 29,
    height: 29,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(216,180,106,0.62)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74,10,36,0.3)",
  },
  defaultServiceInstitutionTitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  defaultServiceInstitutionSubtitle: {
    color: "rgba(216,180,106,0.92)",
    fontSize: 7,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginTop: 2,
  },
});

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
  const insets = useSafeAreaInsets();
  const { data: services = [], isLoading, error, refetch } = useServicesCatalog();
  const { data: events = [], refetch: refetchEvents } = useActiveEvents();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
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

  const serviceIsOpen = (service: (typeof services)[number]) => {
    const now = renderedAt;
    return service.active &&
      (!service.opensAt || now >= new Date(service.opensAt).getTime()) &&
      (!service.closesAt || now <= new Date(service.closesAt).getTime());
  };
  const normalizedSearch = search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visibleServices = [...services]
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

      <View className="border-b border-border bg-background px-6 py-3">
        <View className="gap-2">
          {/* <Text className="font-bold">Buscar trámite, programa o servicio</Text> */}
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar trámite, programa o servicio"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 84 + insets.bottom, paddingTop: 5 }}
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
        <Text className="mb-4 text-xs text-muted-foreground">Ordenados del más solicitado al menos solicitado.</Text>
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
            <View className="mb-3 flex-row items-center justify-between gap-3">
              <Text className="text-lg font-bold">Trámites y servicios</Text>
              <View className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
                <Text className="text-xs font-bold text-primary">
                  {services.length} en total
                </Text>
              </View>
            </View>
            <View className="flex-row flex-wrap justify-between">
              {visibleServices.map((service, index) => {
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
            {!visibleServices.length ? (
              <View className="rounded-2xl border border-border bg-card p-8">
                <Text className="text-center font-semibold">No encontramos trámites con ese nombre.</Text>
                <Pressable onPress={() => setSearch("")}><Text className="mt-2 text-center text-primary">Limpiar búsqueda</Text></Pressable>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
