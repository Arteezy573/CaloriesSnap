import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0f0f1a" },
        headerTintColor: "#fff",
        tabBarStyle: { backgroundColor: "#0f0f1a", borderTopColor: "#333" },
        tabBarActiveTintColor: "#4ecdc4",
        tabBarInactiveTintColor: "#888",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="snap"
        options={{
          title: "Snap",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📸</Text>,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Goals",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
