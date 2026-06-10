import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "expo-router";
import FoodItemRow from "../../components/FoodItemRow";
import MacroBar from "../../components/MacroBar";
import MealCard from "../../components/MealCard";
import {
  DailySummary,
  FoodItem,
  Meal,
  deleteMeal,
  getDailySummary,
  getMeals,
  updateMeal,
} from "../../services/api";
import { localDateString as toISO } from "../../services/dates";

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

  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [editFoods, setEditFoods] = useState<FoodItem[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  function openEdit(meal: Meal) {
    setEditingMeal(meal);
    setEditFoods(meal.foods.map((f) => ({ ...f })));
  }

  function updateEditFood(index: number, updated: FoodItem) {
    setEditFoods((prev) => prev.map((f, i) => (i === index ? updated : f)));
  }

  async function saveEdit() {
    if (!editingMeal) return;
    setSavingEdit(true);
    try {
      await updateMeal(editingMeal.id, { foods: editFoods });
      setEditingMeal(null);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", "Could not update meal: " + e.message);
    } finally {
      setSavingEdit(false);
    }
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
            <MealCard key={meal.id} meal={meal} onDelete={handleDelete} onEdit={openEdit} />
          ))
        )}
      </View>

      <Modal visible={editingMeal !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Meal</Text>
            <ScrollView style={styles.modalScroll}>
              {editFoods.map((food, i) => (
                <FoodItemRow key={i} item={food} index={i} onUpdate={updateEditFood} editable />
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingMeal(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEdit} disabled={savingEdit}>
                <Text style={styles.saveBtnText}>{savingEdit ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#0f0f1a",
    borderRadius: 14,
    padding: 16,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#fff", marginBottom: 12 },
  modalScroll: { flexGrow: 0 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  cancelBtnText: { color: "#fff", fontSize: 14 },
  saveBtn: {
    flex: 1,
    backgroundColor: "#4ecdc4",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#000", fontSize: 14, fontWeight: "bold" },
});
