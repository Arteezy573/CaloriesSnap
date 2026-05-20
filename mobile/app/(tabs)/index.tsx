import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import MacroBar from "../../components/MacroBar";
import MealCard from "../../components/MealCard";
import { DailySummary, Meal, deleteMeal, getDailySummary, getMeals } from "../../services/api";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export default function DashboardScreen() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const date = todayISO();
      const [s, m] = await Promise.all([getDailySummary(date), getMeals(date)]);
      setSummary(s);
      setMeals(m);
    } catch (e: any) {
      Alert.alert("Error", "Could not load data: " + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function handleDelete(mealId: number) {
    try {
      await deleteMeal(mealId);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", "Could not delete meal: " + e.message);
    }
  }

  if (loading || !summary) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4ecdc4" size="large" />
      </View>
    );
  }

  const pct = summary.goals.calories > 0
    ? Math.round((summary.consumed.calories / summary.goals.calories) * 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#4ecdc4" />}
    >
      <View style={styles.header}>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </Text>
        <Text style={styles.calorieText}>
          {summary.consumed.calories} / {summary.goals.calories}
        </Text>
        <Text style={styles.remainingText}>
          kcal remaining: {Math.max(summary.remaining.calories, 0)}
        </Text>
      </View>

      <View style={styles.ring}>
        <Text style={styles.pct}>{pct}%</Text>
      </View>

      <View style={styles.macros}>
        <MacroBar label="Protein" current={summary.consumed.protein_g} goal={summary.goals.protein_g} color="#ff6b6b" />
        <MacroBar label="Carbs" current={summary.consumed.carbs_g} goal={summary.goals.carbs_g} color="#f7dc6f" />
        <MacroBar label="Fat" current={summary.consumed.fat_g} goal={summary.goals.fat_g} color="#45b7d1" />
      </View>

      <View style={styles.mealsSection}>
        <Text style={styles.mealsTitle}>Today's Meals</Text>
        {meals.length === 0 ? (
          <Text style={styles.emptyText}>No meals logged yet. Tap Snap to add one!</Text>
        ) : (
          meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} onDelete={handleDelete} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  center: { flex: 1, backgroundColor: "#0f0f1a", justifyContent: "center", alignItems: "center" },
  header: { alignItems: "center", paddingTop: 16, paddingBottom: 8 },
  dateText: { fontSize: 13, color: "#888" },
  calorieText: { fontSize: 28, fontWeight: "bold", color: "#fff", marginTop: 4 },
  remainingText: { fontSize: 13, color: "#4ecdc4", marginTop: 2 },
  ring: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 10,
    borderColor: "#333",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  pct: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  macros: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 20 },
  mealsSection: { paddingHorizontal: 16, paddingBottom: 32 },
  mealsTitle: { fontSize: 13, color: "#888", marginBottom: 8 },
  emptyText: { color: "#666", fontSize: 14, textAlign: "center", marginTop: 20 },
});
