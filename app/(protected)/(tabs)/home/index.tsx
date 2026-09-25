import { HomeHeader } from "@/src/components/modules/home";
import { Input } from "@/src/components/ui/input";
import { useActiveEvents, useServicesCatalog } from "@/src/hooks/useCatalog";
import { useNewRequest } from "@/src/hooks/useHome";
import { useAuth } from "@/src/providers/AuthProvider";
import { identityApi } from "@/src/services/identityApi";
import type { AttentionEvent } from "@/src/types/catalog";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DEFAULT_SERVICE_LOGO = require("@/src/assets/images/logo-turismo.png");

const styles = StyleSheet.create({
  serviceCardLogoContainer: {
    width: 140,
    height: 42,
  },
  serviceCardLogo: {
    width: "100%",
    height: "100%",
    transform: [{ scale: 2.4 }]
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

      <View className="px-6 py-2 flex-col gap-2">

        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar trámite, programa o servicio"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {/* Catálogo de trámites */}
        {/* <Text className="text-xs text-muted-foreground">Ordenados del más solicitado al menos solicitado.</Text> */}
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
                  {services.length} en Total
                </Text>
              </View>
            </View>
            <View>
              {visibleServices.map((service) => {
                const open = serviceIsOpen(service);
                const opensLater = Boolean(
                  service.opensAt &&
                  new Date(service.opensAt).getTime() > renderedAt,
                );
                return (

                  // PARTE DE RENDERIZADO DE LAS CARDS
                  // <Pressable
                  //   key={service.id}
                  //   className="mb-4 min-h-52 w-full justify-between rounded-2xl border bg-white p-4 active:opacity-70"
                  //   disabled={!selectedEventId}
                  //   onPress={() => handleNavigate({ id: service.id, title: service.name, subtitle: service.description, estado: open }, selectedEventId)}
                  //   style={{
                  //     borderColor: "rgba(152, 22, 70, 0.18)",
                  //     borderWidth: 1,
                  //     shadowColor: "#981646",
                  //     shadowOffset: { width: 0, height: 3 },
                  //     shadowOpacity: 0.1,
                  //     shadowRadius: 7,
                  //     elevation: 3,
                  //   }}
                  // >
                  //   <View className="flex-row items-start justify-between gap-4">
                  //     <View className="min-w-0 flex-1" style={{
                  //       borderColor: "#981646",
                  //       borderWidth: 1,
                  //     }}>
                  //       <View style={styles.serviceCardLogoContainer}>
                  //         <Image
                  //           source={DEFAULT_SERVICE_LOGO}
                  //           resizeMode="contain"
                  //           style={styles.serviceCardLogo}
                  //           accessibilityLabel="Secretaría de Turismo y Desarrollo Económico"
                  //         />
                  //       </View>
                  //       <Text className="mt-3 text-xs font-semibold tracking-wide text-primary/70">
                  //         {service.type.charAt(0).toUpperCase() + service.type.slice(1)}
                  //       </Text>
                  //       <Text className="mt-1 text-base font-bold leading-5 text-primary">
                  //         {service.name}
                  //       </Text>
                  //     </View>

                  //     <View className="max-w-[38%] items-end">
                  //       <View className={`rounded-full px-3 py-1.5 ${open ? "bg-emerald-50" : opensLater ? "bg-amber-50" : "bg-zinc-100"}`}>
                  //         <Text className={`text-center text-[10px] font-bold ${open ? "text-emerald-700" : opensLater ? "text-amber-700" : "text-zinc-600"}`}>
                  //           {open ? "Abierto" : opensLater ? "Próximo" : "Cerrado"}
                  //         </Text>
                  //       </View>
                  //     </View>
                  //   </View>

                  //   <View className="mt-5 flex-row items-center justify-center rounded-xl bg-primary px-4 py-3">
                  //     <Text className="mr-2 font-bold text-primary-foreground">Iniciar solicitud</Text>
                  //     <ChevronRight color="#ffffff" size={19} strokeWidth={2.5} />
                  //   </View>
                  // </Pressable>
                  <Pressable key={service.id}
                    style={{
                      marginBottom: 10,
                      height: 190,
                      width: "100%",
                      borderRadius: 14,
                      // borderWidth: 1,
                      boxShadow: "0 3px 6px rgba(0, 0, 0, 0.3)",
                      // borderColor: "#e4e4e7",
                      backgroundColor: "#ffffff",
                      padding: 12,
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                    disabled={!selectedEventId}
                    onPress={() => handleNavigate({ id: service.id, title: service.name, subtitle: service.description, estado: open }, selectedEventId)}
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <View style={styles.serviceCardLogoContainer}>
                        <Image
                          source={DEFAULT_SERVICE_LOGO}
                          style={styles.serviceCardLogo}
                          resizeMode="contain"
                        />
                      </View>
                      <View className={`shrink-0 rounded-full px-3 py-1.5 ${open ? "bg-emerald-50" : opensLater ? "bg-amber-50" : "bg-zinc-100"}`}>
                        <Text className={`text-xs font-semibold ${open ? "text-emerald-700" : opensLater ? "text-amber-700" : "text-zinc-600"}`}>
                          {open ? "Abierto" : opensLater ? "Próximo" : "Cerrado"}
                        </Text>
                      </View>
                    </View>

                    <View className="min-w-0 flex-1 justify-center">
                      <Text numberOfLines={1} ellipsizeMode="tail" className="text-xs text-zinc-600">
                        {service.type.charAt(0).toUpperCase() + service.type.slice(1)}
                      </Text>
                      <Text numberOfLines={2} ellipsizeMode="tail" className="mt-1 text-base font-semibold leading-5 text-zinc-950">
                        {service.name}
                      </Text>
                    </View>

                    <View className="h-11 w-full items-center justify-center rounded-xl bg-primary">
                      <Text className="text-base font-semibold text-white">Iniciar solicitud</Text>
                    </View>
                  </Pressable>
                  // ******************
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
