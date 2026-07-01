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
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import CalorieRing from "../../components/CalorieRing";
import Confetti from "../../components/Confetti";
import MacroPill from "../../components/MacroPill";
import StreakBadge from "../../components/StreakBadge";
import MealRow from "../../components/MealRow";
import FoodItemRow from "../../components/FoodItemRow";
import ExerciseCard from "../../components/ExerciseCard";
import {
  DailySummary,
  Exercise,
  FoodItem,
  Meal,
  deleteMeal,
  getDailySummary,
  getExercises,
  getHistory,
  getMeals,
  getWeightLogs,
  updateMeal,
} from "../../services/api";
import { localDateString as toISO } from "../../services/dates";
import { computeStreak, StreakInfo } from "../../services/streak";
import { colors, spacing, type } from "../../theme";

const LAST_CELEBRATED_KEY = "lastCelebratedDate";
const EMPTY_STREAK: StreakInfo = { current: 0, best: 0, todayLogged: false, last7: [false, false, false, false, false, false, false] };

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
  return d
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [latestWeightKg, setLatestWeightKg] = useState<number | null>(null);
  const [streak, setStreak] = useState<StreakInfo>(EMPTY_STREAK);
  const [celebrating, setCelebrating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isToday = selectedDate === todayISO();

  async function loadStreak() {
    const today = todayISO();
    try {
      const history = await getHistory(shiftDate(today, -89), today);
      const s = computeStreak(history, today);
      setStreak(s);

      // Celebrate the first log of the day, once.
      if (s.todayLogged) {
        const last = await AsyncStorage.getItem(LAST_CELEBRATED_KEY);
        if (last !== today) {
          await AsyncStorage.setItem(LAST_CELEBRATED_KEY, today);
          setCelebrating(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast(`🔥 ${s.current}-day streak!`);
          setTimeout(() => setCelebrating(false), 1100);
        }
      }
    } catch {
      // streak is decorative — never block the dashboard on it
    }
  }

  async function loadLatestWeight() {
    const today = todayISO();
    try {
      // most recent weigh-in personalizes the exercise calorie-burn estimate
      const logs = await getWeightLogs(shiftDate(today, -180), today);
      if (logs.length > 0) {
        const latest = logs.reduce((a, b) => (a.date >= b.date ? a : b));
        setLatestWeightKg(latest.weight_kg);
      }
    } catch {
      // estimate falls back to a default weight if this fails
    }
  }

  async function loadData(date?: string) {
    const d = date || selectedDate;
    try {
      const [s, m, ex] = await Promise.all([getDailySummary(d), getMeals(d), getExercises(d)]);
      setSummary(s);
      setMeals(m);
      setExercises(ex);
      loadStreak();
      loadLatestWeight();
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

  function changeDay(days: number) {
    const next = shiftDate(selectedDate, days);
    if (days > 0 && isToday) return;
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

  function removeEditFood(index: number) {
    setEditFoods((prev) => prev.filter((_, i) => i !== index));
  }

  function addEditFood() {
    setEditFoods((prev) => [
      ...prev,
      { name: "", quantity: "1 serving", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    ]);
  }

  async function saveEdit() {
    if (!editingMeal) return;
    setSavingEdit(true);
    try {
      await updateMeal(editingMeal.id, { foods: editFoods });
      setEditingMeal(null);
      showToast("Meal updated");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", "Could not update meal: " + e.message);
    } finally {
      setSavingEdit(false);
    }
  }

  function confirmDelete(mealId: number) {
    Alert.alert("Delete meal?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMeal(mealId);
            showToast("Meal deleted");
            loadData();
          } catch (e: any) {
            Alert.alert("Error", "Could not delete meal: " + e.message);
          }
        },
      },
    ]);
  }

  if (loading || !summary) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.s, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={type.label}>{formatDate(selectedDate)}</Text>
          <Text style={type.largeTitle}>{isToday ? "Today" : "History"}</Text>
        </View>
        <StreakBadge streak={streak} />
      </View>

      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => changeDay(-1)} hitSlop={12} style={styles.arrow}>
          <Ionicons name="chevron-back" size={20} color={colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} disabled={isToday}>
          <Text style={styles.dateNavText}>{isToday ? "" : "Back to today"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => changeDay(1)} hitSlop={12} style={styles.arrow} disabled={isToday}>
          <Ionicons name="chevron-forward" size={20} color={isToday ? colors.separator : colors.accent} />
        </TouchableOpacity>
      </View>

      <Card style={styles.ringCard}>
        <CalorieRing consumed={summary.consumed.calories} goal={summary.goals.calories} />
        <Text style={styles.ringCaption}>
          {summary.consumed.calories} eaten
          {summary.calories_burned > 0 ? ` · ${summary.calories_burned} burned` : ""}
          {" · "}
          {summary.goals.calories} goal
        </Text>
        <View style={styles.macroRow}>
          <MacroPill label="Protein" current={summary.consumed.protein_g} goal={summary.goals.protein_g} color={colors.protein} />
          <MacroPill label="Carbs" current={summary.consumed.carbs_g} goal={summary.goals.carbs_g} color={colors.carbs} />
          <MacroPill label="Fat" current={summary.consumed.fat_g} goal={summary.goals.fat_g} color={colors.fat} />
        </View>
        {celebrating && <Confetti />}
      </Card>

      <Text style={[type.label, styles.sectionLabel]}>MEALS</Text>
      {meals.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🍽️</Text>
          <Text style={type.headline}>{isToday ? "No meals yet" : "Nothing logged this day"}</Text>
          {isToday && (
            <>
              <Text style={[type.footnote, { textAlign: "center", marginTop: 4 }]}>
                Snap a photo and AI does the math.
              </Text>
              <Button title="Snap your first meal" onPress={() => router.navigate("/snap")} style={{ marginTop: 14, alignSelf: "stretch" }} />
            </>
          )}
        </Card>
      ) : (
        <Card style={styles.mealsCard}>
          {meals.map((meal, i) => (
            <MealRow key={meal.id} meal={meal} isLast={i === meals.length - 1} onEdit={openEdit} onDelete={confirmDelete} />
          ))}
        </Card>
      )}

      <Text style={[type.label, styles.sectionLabel]}>EXERCISE</Text>
      <ExerciseCard
        exercises={exercises}
        date={selectedDate}
        bodyWeightKg={latestWeightKg}
        editable={isToday}
        onChanged={loadData}
      />

      <Modal visible={editingMeal !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={type.title}>Edit Meal</Text>
            <ScrollView style={styles.modalScroll}>
              {editFoods.map((food, i) => (
                <FoodItemRow
                  key={i}
                  item={food}
                  index={i}
                  onUpdate={updateEditFood}
                  onRemove={removeEditFood}
                  editable
                />
              ))}
              <TouchableOpacity onPress={addEditFood} style={styles.addIngredient} hitSlop={8}>
                <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
                <Text style={styles.addIngredientText}>Add ingredient</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="tinted" onPress={() => setEditingMeal(null)} style={{ flex: 1 }} />
              <Button
                title="Save"
                onPress={saveEdit}
                loading={savingEdit}
                disabled={editFoods.length === 0}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.l,
  },
  dateNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.xs,
  },
  arrow: { padding: spacing.s },
  dateNavText: { fontSize: 13, color: colors.accent, fontWeight: "600" },
  ringCard: { marginHorizontal: spacing.l, alignItems: "center", overflow: "hidden" },
  ringCaption: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.s },
  macroRow: { flexDirection: "row", gap: spacing.s, marginTop: spacing.m, alignSelf: "stretch" },
  sectionLabel: { marginTop: spacing.l, marginBottom: spacing.s, marginLeft: spacing.l + 4 },
  mealsCard: { marginHorizontal: spacing.l, paddingVertical: spacing.xs },
  emptyCard: { marginHorizontal: spacing.l, alignItems: "center", paddingVertical: spacing.xl },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.s },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: spacing.l },
  modalCard: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.l, maxHeight: "80%" },
  modalScroll: { flexGrow: 0, marginTop: spacing.m },
  addIngredient: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.s, marginTop: spacing.xs },
  addIngredientText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: spacing.m, marginTop: spacing.l },
});
