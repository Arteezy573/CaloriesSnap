import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0f0f1a" },
        headerTintColor: "#fff",
        headerShown: false,
      }}
    />
  );
}
