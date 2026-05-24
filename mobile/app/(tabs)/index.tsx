import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "expo-router";
import MacroBar from "../../components/MacroBar";
import MealCard from "../../components/MealCard";
import { DailySummary, Meal, deleteMeal, getDailySummary, getMeals } from "../../services/api";

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function todayISO(): string {
  return toISO(new Date());
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function DashboardScreen() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isToday = selectedDate === todayISO();

  async function loadData(date?: string) {
    const d = date || selectedDate;
    try {
      const [s, m] = await Promise.all([getDailySummary(d), getMeals(d)]);
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
    }, [selectedDate])
  );

  function goToPreviousDay() {
    const prev = shiftDate(selectedDate, -1);
    setSelectedDate(prev);
    setLoading(true);
    loadData(prev);
  }

  function goToNextDay() {
    if (isToday) return;
    const next = shiftDate(selectedDate, 1);
    setSelectedDate(next);
    setLoading(true);
    loadData(next);
  }

  function goToToday() {
    const today = todayISO();
    setSelectedDate(today);
    setLoading(true);
    loadData(today);
  }

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
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={goToPreviousDay} style={styles.arrow}>
          <Text style={styles.arrowText}>{"<"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday}>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          {!isToday && <Text style={styles.todayHint}>Tap for today</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNextDay} style={styles.arrow} disabled={isToday}>
          <Text style={[styles.arrowText, isToday && { color: "#333" }]}>{">"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
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
        <Text style={styles.mealsTitle}>{isToday ? "Today's Meals" : "Meals"}</Text>
        {meals.length === 0 ? (
          <Text style={styles.emptyText}>
            {isToday ? "No meals logged yet. Tap Snap to add one!" : "No meals logged this day."}
          </Text>
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
  dateNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  arrow: { padding: 12 },
  arrowText: { fontSize: 24, color: "#4ecdc4", fontWeight: "bold" },
  dateText: { fontSize: 14, color: "#888", textAlign: "center" },
  todayHint: { fontSize: 11, color: "#4ecdc4", textAlign: "center", marginTop: 2 },
  header: { alignItems: "center", paddingTop: 8, paddingBottom: 8 },
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
