import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { Exercise, logExercise, deleteExercise } from "../services/api";
import {
  EXERCISE_PRESETS,
  ExercisePreset,
  estimateCaloriesBurned,
  sumCaloriesBurned,
  presetByName,
} from "../services/exercise";
import { colors, radii, spacing, type } from "../theme";

const DEFAULT_WEIGHT_KG = 70; // fallback when the user hasn't logged a weight yet

interface Props {
  exercises: Exercise[];
  date: string; // the day these exercises belong to
  bodyWeightKg: number | null;
  editable: boolean; // only allow logging on the active day
  onChanged: () => void;
}

export default function ExerciseCard({ exercises, date, bodyWeightKg, editable, onChanged }: Props) {
  const [selected, setSelected] = useState<ExercisePreset | null>(null);
  const [duration, setDuration] = useState("30");
  const [saving, setSaving] = useState(false);

  const weight = bodyWeightKg && bodyWeightKg > 0 ? bodyWeightKg : DEFAULT_WEIGHT_KG;
  const totalBurned = sumCaloriesBurned(exercises);
  const durationMin = parseInt(duration, 10);
  const estimate =
    selected && isFinite(durationMin) && durationMin > 0
      ? estimateCaloriesBurned(selected.met, durationMin, weight)
      : 0;

  async function handleLog() {
    if (!selected) {
      Alert.alert("Pick an activity", "Choose an exercise to log.");
      return;
    }
    if (!isFinite(durationMin) || durationMin <= 0) {
      Alert.alert("Enter a duration", "Please enter how many minutes you exercised.");
      return;
    }
    setSaving(true);
    try {
      await logExercise({
        date,
        name: selected.name,
        duration_min: durationMin,
        calories_burned: estimate,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelected(null);
      setDuration("30");
      onChanged();
    } catch (e: any) {
      Alert.alert("Error", "Could not save exercise: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: number) {
    Alert.alert("Delete exercise?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteExercise(id);
            onChanged();
          } catch (e: any) {
            Alert.alert("Error", "Could not delete exercise: " + e.message);
          }
        },
      },
    ]);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>Exercise</Text>
        <Text style={styles.burned}>🔥 {totalBurned} cal</Text>
      </View>

      {exercises.length === 0 ? (
        <Text style={[type.footnote, styles.empty]}>
          {editable
            ? "No workouts yet. Log one to earn back calories."
            : "Nothing logged this day."}
        </Text>
      ) : (
        <View style={styles.list}>
          {exercises.map((e, i) => (
            <View key={e.id} style={[styles.row, i !== exercises.length - 1 && styles.rowBorder]}>
              <Text style={styles.rowEmoji}>{presetByName(e.name)?.emoji ?? "🔥"}</Text>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={styles.rowDetail}>{e.duration_min} min</Text>
              </View>
              <Text style={styles.rowKcal}>{e.calories_burned}</Text>
              <TouchableOpacity onPress={() => confirmDelete(e.id)} style={styles.deleteBtn} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {editable && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {EXERCISE_PRESETS.map((p) => {
              const active = selected?.name === p.name;
              return (
                <TouchableOpacity
                  key={p.name}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelected(active ? null : p)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipEmoji}>{p.emoji}</Text>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selected && (
            <View style={styles.logRow}>
              <View style={styles.durationField}>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={duration}
                  onChangeText={setDuration}
                  returnKeyType="done"
                  onSubmitEditing={handleLog}
                  maxLength={4}
                />
                <Text style={styles.unit}>min</Text>
              </View>
              <Text style={styles.estimate}>≈ {estimate} cal</Text>
              <Button title="Log" onPress={handleLog} loading={saving} style={styles.logBtn} />
            </View>
          )}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.l, marginBottom: spacing.m },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontSize: 14, fontWeight: "700", color: colors.accent },
  burned: { fontSize: 17, fontWeight: "700", color: colors.text },
  empty: { paddingVertical: spacing.m },
  list: { marginTop: spacing.s },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  rowEmoji: {
    fontSize: 20,
    width: 40,
    height: 40,
    lineHeight: 40,
    textAlign: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.m - 2,
    overflow: "hidden",
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "600", color: colors.text },
  rowDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  rowKcal: { fontSize: 15, fontWeight: "700", color: colors.text },
  deleteBtn: { paddingLeft: 4, paddingVertical: 4 },
  chipScroll: { marginTop: spacing.m },
  chipRow: { gap: spacing.s, paddingRight: spacing.s },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipEmoji: { fontSize: 15 },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  chipTextActive: { color: colors.tipText },
  logRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.m, gap: spacing.s },
  durationField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.fill,
    borderRadius: radii.m,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  input: { fontSize: 17, color: colors.text, paddingVertical: 11, minWidth: 44, textAlign: "center" },
  unit: { fontSize: 15, color: colors.textSecondary },
  estimate: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
  logBtn: { paddingHorizontal: spacing.xl },
});
