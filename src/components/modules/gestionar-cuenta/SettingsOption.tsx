import { Text } from "@/src/components/ui/text";
import { THEME } from "@/src/components/ui/lib/theme";
import { useTheme } from "@/src/providers/ThemeProvider";
import { AccountOption } from "@/src/types/gestionar-cuenta";
import Monicon from "@monicon/native";
import { Pressable, View } from "react-native";

interface SettingsOptionProps {
  option: AccountOption;
  isLast: boolean;
}

export function SettingsOption({ option, isLast }: SettingsOptionProps) {
  const { colorScheme } = useTheme();
  const cardForegroundColor = THEME[colorScheme].cardForeground;
  const mutedForegroundColor = THEME[colorScheme].mutedForeground;
  const destructiveColor = THEME[colorScheme].destructive;

  const isDestructive = option.variant === "destructive";

  return (
    <Pressable
      onPress={option.onPress}
      className={`active:opacity-70 ${isLast ? "" : "border-b border-border"}`}
    >
      <View className="flex-row items-center justify-between px-4 py-4">
        <View className="flex-row items-center flex-1 gap-4">
          <View
            className={`h-10 w-10 items-center justify-center rounded-full ${isDestructive ? "bg-destructive/10" : "bg-primary/10"}`}
          >
            <Monicon
              name={option.iconName}
              size={22}
              color={isDestructive ? destructiveColor : "#981646"}
            />
          </View>
          <View className="flex-1">
            <Text
              className="font-semibold"
              style={{
                color: isDestructive ? destructiveColor : cardForegroundColor,
              }}
            >
              {option.title}
            </Text>
            {option.description && (
              <Text
                className="mt-1 text-xs"
                style={{
                  color: isDestructive
                    ? `${destructiveColor}CC`
                    : mutedForegroundColor,
                }}
              >
                {option.description}
              </Text>
            )}
          </View>
        </View>
        <Monicon
          name="material-symbols:chevron-right"
          size={20}
          color={mutedForegroundColor}
        />
      </View>
    </Pressable>
  );
}


