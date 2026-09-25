import { Button } from "@/src/components/ui/button";
import { THEME } from "@/src/components/ui/lib/theme";
import { Progress } from "@/src/components/ui/progress";
import { Text } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import Monicon from "@monicon/native";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FormHeaderProps {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  icon: string;
  directionName?: string;
  onBack?: () => void;
  backRoute?: string;
}

export const FormHeader: React.FC<FormHeaderProps> = ({
  step,
  totalSteps,
  title,
  description,
  icon,
  directionName,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const primaryColor = THEME[colorScheme].primary;
  const foregroundColor = THEME[colorScheme].foreground;
  const mutedForegroundColor = THEME[colorScheme].mutedForeground;

  return (
    <View
      className="px-6 pb-4 gap-2 bg-transparent flex"
      style={{
        paddingTop: insets.top + 12,
      }}
    >
      <View className="flex-row items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onPress={() => router.back()}
          className="rounded-full "
        >
          {Platform.OS !== "web" ? (
            <Monicon
              name="ic:baseline-arrow-back-ios-new"
              size={24}
              color={foregroundColor}
            />
          ) : null}
        </Button>
        <Text className="text-lg font-bold" style={{ color: primaryColor }}>
          {directionName}
        </Text> 
      </View>

      <View >
        <Text className="text-lg font-bold text-center" style={{ color: foregroundColor }}>
          {title}
        </Text>
        <Text
          className="text-md text-center"
          style={{ color: mutedForegroundColor }}
        >
          {description}
        </Text>
        <Text className="text-md text-center" style={{ color: mutedForegroundColor }}>
          Paso {step + 1} de {totalSteps}
        </Text>
      </View>

      <Progress
        value={((step + 1) / totalSteps) * 100}
        className="bg-white/60 dark:bg-white/20"
        gradientColors={[primaryColor, primaryColor]}
      />
    </View>
  );
};
