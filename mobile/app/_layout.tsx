import { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToken, isTokenExpired, setOnAuthStateChange } from "../services/auth";
import { setOnUnauthorized } from "../services/api";
import { ToastProvider } from "../components/ui/Toast";
import { colors } from "../theme";

export const PENDING_ONBOARDING_KEY = "pendingOnboarding";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  const handleUnauthorized = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    setOnUnauthorized(handleUnauthorized);
    setOnAuthStateChange(setIsAuthenticated);
  }, [handleUnauthorized]);

  useEffect(() => {
    async function checkAuth() {
      const token = await getToken();
      setIsAuthenticated(!!token && !isTokenExpired(token));
      setIsReady(true);
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuth = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuth) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuth) {
      // New registrations go through the goal wizard first.
      AsyncStorage.getItem(PENDING_ONBOARDING_KEY).then((pending) => {
        if (pending) {
          router.replace("/onboarding");
        } else {
          router.replace("/(tabs)");
        }
      });
    }
  }, [isReady, isAuthenticated, segments, router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
        </Stack>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
