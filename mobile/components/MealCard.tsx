import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Meal } from "../services/api";

interface Props {
  meal: Meal;
  onDelete: (id: number) => void;
}

export default function MealCard({ meal, onDelete }: Props) {
  const icon = meal.source === "photo" ? "📷" : "✏️";
  const foodNames = meal.foods.map((f) => f.name).join(", ");

  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.info}>
        <Text style={styles.time}>
          {new Date(meal.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
        <Text style={styles.foods} numberOfLines={1}>{foodNames}</Text>
      </View>
      <Text style={styles.calories}>{meal.total_calories} kcal</Text>
      <TouchableOpacity onPress={() => onDelete(meal.id)} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e1e36",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: { fontSize: 24, width: 36, textAlign: "center" },
  info: { flex: 1 },
  time: { color: "#fff", fontSize: 14, fontWeight: "600" },
  foods: { color: "#888", fontSize: 12, marginTop: 2 },
  calories: { color: "#4ecdc4", fontSize: 14, fontWeight: "bold" },
  deleteBtn: { padding: 4 },
  deleteText: { color: "#666", fontSize: 20 },
});
