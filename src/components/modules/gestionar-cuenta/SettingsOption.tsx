import { AccountOption } from "@/src/types/gestionar-cuenta";
import { SettingsRow } from "./SettingsCard";

interface SettingsOptionProps {
  option: AccountOption;
  isLast: boolean;
}

export function SettingsOption({ option, isLast }: SettingsOptionProps) {
  return (
    <SettingsRow
      icon={option.iconName}
      title={option.title}
      description={option.description}
      onPress={option.onPress}
      destructive={option.variant === "destructive"}
      isLast={isLast}
    />
  );
}
