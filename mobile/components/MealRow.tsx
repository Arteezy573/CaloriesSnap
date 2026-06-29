import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";
import { Meal } from "../services/api";

const EMOJI_MAP: [RegExp, string][] = [
  [/salad|lettuce|greens/i, "🥗"],
  [/noodle|ramen|pasta|spaghetti/i, "🍜"],
  [/rice/i, "🍚"],
  [/chicken/i, "🍗"],
  [/beef|steak|pork/i, "🥩"],
  [/fish|salmon|tuna|shrimp/i, "🐟"],
  [/egg/i, "🍳"],
  [/bread|toast|sandwich/i, "🥪"],
  [/burger/i, "🍔"],
  [/pizza/i, "🍕"],
  [/soup|stew|broth/i, "🍲"],
  [/apple|banana|fruit|berry|orange/i, "🍎"],
  [/coffee|latte|espresso/i, "☕"],
  [/yogurt|milk|cheese/i, "🥛"],
  [/tofu/i, "🥡"],
];

export function mealEmoji(meal: Meal): string {
  const names = meal.foods.map((f) => f.name).join(" ");
  for (const [re, emoji] of EMOJI_MAP) {
    if (re.test(names)) return emoji;
  }
  return "🍽️";
}

interface Props {
  meal: Meal;
  isLast: boolean;
  onEdit: (meal: Meal) => void;
  onDelete: (id: number) => void;
}

export default function MealRow({ meal, isLast, onEdit, onDelete }: Props) {
  const title = meal.foods[0]?.name ?? "Meal";
  const time = new Date(meal.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <TouchableOpacity style={styles.main} onPress={() => onEdit(meal)} activeOpacity={0.6}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>{mealEmoji(meal)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.detail}>
            {time} · {meal.foods.length} item{meal.foods.length === 1 ? "" : "s"}
          </Text>
        </View>
        <Text style={styles.kcal}>{meal.total_calories}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDelete(meal.id)} style={styles.deleteBtn} hitSlop={8}>
        <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.m - 2,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: { fontSize: 20 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  detail: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  kcal: { fontSize: 15, fontWeight: "700", color: colors.text },
  deleteBtn: { paddingLeft: 12, paddingVertical: 4 },
});
