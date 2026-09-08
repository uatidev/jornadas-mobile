import { Button } from "@/src/components/ui/button";
import { THEME } from "@/src/components/ui/lib/theme";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/src/components/ui/select";
import { Text } from "@/src/components/ui/text";
import { UserMenu } from "@/src/components/user-menu";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { AttentionEvent } from "@/src/types/catalog";
import Monicon from "@monicon/native";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface HomeHeaderProps {
  onLogout: () => void;
  events: AttentionEvent[];
  selectedEventId: string;
  onEventChange: (eventId: string) => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  onLogout,
  events,
  selectedEventId,
  onEventChange,
}) => {
  const { user } = useAuth();
  const { colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const selectedEvent = events.find((event) => event.id === selectedEventId);

  const formatSchedule = (event: AttentionEvent) => {
    const start = new Date(event.startsAt).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (!event.endsAt) return start;

    const end = new Date(event.endsAt).toLocaleTimeString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${start} – ${end}`;
  };

  return (
    <View
      className="px-3 pt-6"
      style={{
        paddingTop: insets.top + 10,
        backgroundColor: "transparent",
        // borderColor: "red",
        // borderWidth: 1
      }}
    >
      <View className="flex-row justify-between items-center mb-2" style={{
        // backgroundColor: "transparent",
        // borderColor: "red",
        // borderWidth: 1
      }}>
        <View className="mx-2 flex-1" style={{
          // backgroundColor: "transparent",
          // borderColor: "red",
          // borderWidth: 1
        }}>
          {/* HACER QUE SI ESTA MUY LARGO */}
          <Select

            value={
              selectedEventId
                ? {
                  value: selectedEventId,
                  label:
                    events.find((event) => event.id === selectedEventId)
                      ?.name ?? "Evento",
                }
                : undefined
            }
            onValueChange={(option) => {
              if (option?.value) onEventChange(option.value);
            }}
            disabled={!events.length}
          >
            <SelectTrigger className="h-auto w-full rounded-xl bg-card py-2">
              {selectedEvent ? (
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-bold" numberOfLines={1}>
                    {selectedEvent.name}
                  </Text>
                  {/* <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                    {selectedEvent.locality}, {selectedEvent.municipality} · {selectedEvent.venue}
                  </Text> */}
                  {/* <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                    {formatSchedule(selectedEvent)}
                  </Text> */}
                </View>
              ) : (
                <Text className="text-sm text-muted-foreground">
                  Seleccionar evento
                </Text>
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {events.map((event) => (
                  <SelectItem
                    key={event.id}
                    label={`${event.name}`}
                    value={event.id}
                  >
                    <View className="flex-1">
                      <Text className="font-bold">{event.name}</Text>
                      <Text className="mt-1 text-sm text-muted-foreground">
                        {event.locality}, {event.municipality} · {event.venue}
                      </Text>
                      <Text className="mt-1 text-xs text-muted-foreground">
                        {formatSchedule(event)}
                      </Text>
                    </View>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </View>

        {Platform.OS === "web" ? <View className="flex-row items-center gap-2">
          {/* <Button
            variant="ghost"
            size="icon"
            onPress={toggleTheme}
            className="rounded-full"
          >
            <Monicon
              name={
                colorScheme === "dark"
                  ? "ic:outline-light-mode"
                  : "ic:outline-dark-mode"
              }
              size={24}
              color={iconColor}
            />
          </Button> */}
          <UserMenu user={user} onLogout={onLogout} />
        </View> : (
          <Button
            variant="ghost"
            size="icon"
            onPress={onLogout}
            className="rounded-full"
            accessibilityLabel="Cerrar sesión"
          >
            <Monicon
              name="ic:outline-logout"
              size={24}
              color={THEME[colorScheme].destructive}
            />
          </Button>
        )}
      </View>

      {/* <Text className="text-2xl font-bold text-foreground">
        Bienvenido, {user?.nombre}
      </Text> */}
      {/* <Text className="text-base text-muted-foreground">
        Trámites y servicios de la SECTUR en un solo lugar
      </Text> */}
    </View>
  );
};
