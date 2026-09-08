import { Text } from "@/src/components/ui/text";
import { SettingsGroup as SettingsGroupType } from "@/src/types/gestionar-cuenta";
import { View } from "react-native";
import { SettingsOption } from "./SettingsOption";

interface SettingsGroupProps {
  group: SettingsGroupType;
}

export function SettingsGroup({ group }: SettingsGroupProps) {
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      <View className="border-b border-border px-4 py-3">
        <Text className="text-sm font-bold text-muted-foreground">
          {group.title.toUpperCase()}
        </Text>
      </View>
      <View>
        {group.options.map((option, index) => (
          <SettingsOption
            key={option.id}
            option={option}
            isLast={index === group.options.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

