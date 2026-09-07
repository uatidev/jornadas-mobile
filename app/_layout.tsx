import "react-native-url-polyfill/auto";
import "@/global.css";
import { DeepLinkHandler } from "@/src/components/common/DeepLinkHandler";
import { NAV_THEME } from "@/src/components/ui/lib/theme";
import { AuthProvider } from "@/src/providers/AuthProvider";
import {
  ThemeProvider as CustomThemeProvider,
  useTheme,
} from "@/src/providers/ThemeProvider";
import { ThemeProvider } from "expo-router/react-navigation";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NavigationThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme } = useTheme();

  return (
    <ThemeProvider value={NAV_THEME[colorScheme]}>{children}</ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <CustomThemeProvider>
            <AuthProvider>
              <NavigationThemeProvider>
                <DeepLinkHandler />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: "slide_from_right",
                  }}
                >
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="splash" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="(protected)"
                    options={{ headerShown: false }}
                  />
                </Stack>
              </NavigationThemeProvider>
            </AuthProvider>
          </CustomThemeProvider>
          <PortalHost />
        </KeyboardProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
