import { CollapsingHeaderScrollView } from "@/src/components/common/CollapsingHeader";
import { GlassInput } from "@/src/components/common/GlassInput";
import { GlassSelect } from "@/src/components/common/GlassSelect";
import { useGlassTabBarSpace } from "@/src/components/common/GlassTabBar";
import { RequestListItem, RequestListItemSkeleton } from "@/src/components/modules/mis-solicitudes";
import { Button } from "@/src/components/ui/button";
import { Text } from "@/src/components/ui/text";
import { useActiveEvents } from "@/src/hooks/useCatalog";
import { useMyRequests, type MyRequestItem, type MyRequestKind } from "@/src/hooks/useMyRequests";
import { setSelectedEventId, useSelectedEventId } from "@/src/hooks/useSelectedEvent";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

const KIND_FILTERS: { value: MyRequestKind | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "regular", label: "Trámites" },
  { value: "secretary", label: "Secretaría" },
];

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** "Hoy", "Ayer" o la fecha (p. ej. "lunes, 6 de octubre"). */
const dayLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return "Hoy";
  if (dayKey(date) === dayKey(yesterday)) return "Ayer";
  return date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
};

function FilterChip({ label, count, selected, onPress }: { label: string; count?: number; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ paddingInline: 10 }}
      className={`h-8 flex-row items-center gap-1.5 rounded-full border ${selected ? "border-primary bg-primary" : "border-border bg-card"}`}
    >
      <Text className={`text-xs font-semibold ${selected ? "text-white" : "text-muted-foreground"}`}>{label}</Text>
      {count !== undefined ? (
        <View className={`min-w-5 items-center rounded-full px-1.5 ${selected ? "bg-white/25" : "bg-muted"}`}>
          <Text className={`text-[11px] font-bold ${selected ? "text-white" : "text-muted-foreground"}`}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function MisSolicitudesScreen() {
  const router = useRouter();
  const tabBarSpace = useGlassTabBarSpace();
  const activeEvents = useActiveEvents();
  const myRequests = useMyRequests();
  const sharedEventId = useSelectedEventId();
  const [kind, setKind] = useState<MyRequestKind | "all">("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const events = activeEvents.data || [];
  const effectiveEventId = events.some((event) => event.id === sharedEventId)
    ? sharedEventId
    : events[0]?.id || "";

  const eventItems = useMemo(
    () =>
      myRequests.items.filter(
        (item) => item.eventId === effectiveEventId && (kind === "all" || item.kind === kind),
      ),
    [myRequests.items, effectiveEventId, kind],
  );

  // Estatus presentes en el evento (y tipo) elegido, con su cantidad.
  const statusCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    eventItems.forEach((item) => {
      const current = counts.get(item.status);
      counts.set(item.status, { label: item.statusLabel, count: (current?.count || 0) + 1 });
    });
    return [...counts.entries()].sort((first, second) => second[1].count - first[1].count);
  }, [eventItems]);
  const effectiveStatus = statusCounts.some(([value]) => value === status) ? status : "all";

  const visibleItems = useMemo(() => {
    const query = normalize(search.trim());
    return eventItems
      .filter((item) => effectiveStatus === "all" || item.status === effectiveStatus)
      .filter(
        (item) =>
          !query ||
          normalize(`${item.folio} ${item.title} ${item.applicantName || ""}`).includes(query),
      );
  }, [eventItems, effectiveStatus, search]);

  const groups = useMemo(() => {
    const result: { label: string; items: MyRequestItem[] }[] = [];
    visibleItems.forEach((item) => {
      const label = dayLabel(item.date);
      const last = result[result.length - 1];
      if (last?.label === label) last.items.push(item);
      else result.push({ label, items: [item] });
    });
    return result;
  }, [visibleItems]);

  const hasFilters = Boolean(search.trim()) || effectiveStatus !== "all" || kind !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setKind("all");
  };

  const loading = activeEvents.isLoading || myRequests.isLoading;
  const error = activeEvents.error || myRequests.error;

  return (
    <View className="flex-1 bg-background">
      <CollapsingHeaderScrollView
        title="Mis solicitudes"
        subtitle="Consulta las solicitudes que has capturado por evento."
        largeTitleAlign="center"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: tabBarSpace + 8,
        }}
        refreshControl={
          <RefreshControl
            refreshing={myRequests.isRefetching}
            onRefresh={() => {
              void Promise.all([myRequests.refetch(), activeEvents.refetch()]);
            }}
            tintColor="#981646"
            colors={["#981646"]}
          />
        }
      >
        <View className="mx-auto w-full max-w-[672px] gap-3">
          {events.length ? (
            <GlassSelect
              leftIcon="ci:calendar-event"
              placeholder="Selecciona un evento activo"
              options={events.map((event) => ({
                value: event.id,
                label: event.name,
                description: `${event.municipality} · ${event.venue}`,
              }))}
              value={effectiveEventId}
              onChange={setSelectedEventId}
            />
          ) : null}

          {events.length ? (
            <GlassInput
              leftIcon="ci:search-magnifying-glass"
              returnKeyType="search"
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar folio, trámite o solicitante"
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : null}

          {myRequests.withSecretary && events.length ? (
            <View className="flex-row gap-2">
              {KIND_FILTERS.map((filter) => (
                <FilterChip
                  key={filter.value}
                  label={filter.label}
                  selected={kind === filter.value}
                  onPress={() => setKind(filter.value)}
                />
              ))}
            </View>
          ) : null}

          {statusCounts.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <FilterChip
                label="Todos"
                count={eventItems.length}
                selected={effectiveStatus === "all"}
                onPress={() => setStatus("all")}
              />
              {statusCounts.map(([value, { label, count }]) => (
                <FilterChip
                  key={value}
                  label={label}
                  count={count}
                  selected={effectiveStatus === value}
                  onPress={() => setStatus(value)}
                />
              ))}
            </ScrollView>
          ) : null}

          <View className="mt-2">
            {loading ? (
              [0, 1, 2, 3].map((index) => <RequestListItemSkeleton key={index} />)
            ) : error ? (
              <View className="rounded-2xl border border-destructive/30 bg-card p-5">
                <Text className="font-semibold text-destructive">
                  No fue posible cargar tus solicitudes.
                </Text>
                <Button
                  className="mt-4"
                  onPress={() => {
                    void Promise.all([myRequests.refetch(), activeEvents.refetch()]);
                  }}
                >
                  <Text>Reintentar</Text>
                </Button>
              </View>
            ) : !events.length ? (
              <View className="items-center rounded-2xl border border-border bg-card px-5 py-12">
                <Text className="text-lg font-bold">No hay eventos activos</Text>
                <Text className="mt-2 text-center text-muted-foreground">
                  Tus capturas aparecerán cuando exista un evento activo.
                </Text>
              </View>
            ) : !visibleItems.length ? (
              <View className="items-center rounded-2xl border border-border bg-card px-5 py-10">
                <Text className="text-center font-bold">
                  {hasFilters ? "No hay solicitudes con esos filtros" : "Aún no hay capturas en este evento"}
                </Text>
                {hasFilters ? (
                  <Pressable onPress={clearFilters}>
                    <Text className="mt-2 text-center text-primary">Limpiar filtros</Text>
                  </Pressable>
                ) : (
                  <Text className="mt-2 text-center text-sm text-muted-foreground">
                    Las solicitudes que registres aparecerán aquí.
                  </Text>
                )}
              </View>
            ) : (
              groups.map((group) => (
                <View key={group.label} className="mb-2">
                  <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </Text>
                  {group.items.map((item) => (
                    <RequestListItem
                      key={item.key}
                      item={item}
                      onPress={() =>
                        router.push({
                          pathname: "/solicitud/[id]",
                          params: { id: item.id, kind: item.kind },
                        } as any)
                      }
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        </View>
      </CollapsingHeaderScrollView>
    </View>
  );
}
