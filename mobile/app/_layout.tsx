import { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { getToken, isTokenExpired, setOnAuthStateChange } from "../services/auth";
import { setOnUnauthorized } from "../services/api";

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
      router.replace("/(tabs)");
    }
  }, [isReady, isAuthenticated, segments, router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f0f1a" }}>
        <ActivityIndicator size="large" color="#4ecdc4" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
