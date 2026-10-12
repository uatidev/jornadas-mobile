import { SettingsGroup as SettingsGroupType } from "@/src/types/gestionar-cuenta";
import { SettingsCard } from "./SettingsCard";
import { SettingsOption } from "./SettingsOption";

interface SettingsGroupProps {
  group: SettingsGroupType;
}

export function SettingsGroup({ group }: SettingsGroupProps) {
  return (
    <SettingsCard title={group.title}>
      {group.options.map((option, index) => (
        <SettingsOption
          key={option.id}
          option={option}
          isLast={index === group.options.length - 1}
        />
      ))}
    </SettingsCard>
  );
}
