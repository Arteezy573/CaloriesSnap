import { View, Text, StyleSheet } from "react-native";
import Card from "./ui/Card";
import { colors, type } from "../theme";
import { HistoryEntry, Goals } from "../services/api";
import { StreakInfo } from "../services/streak";

interface Props {
  week: HistoryEntry[]; // last 7 days, any order
  goals: Goals;
  streak: StreakInfo;
}

export default function WeeklyReportCard({ week, goals, streak }: Props) {
  const daysLogged = week.filter((d) => d.meals_count > 0);
  const avg = daysLogged.length
    ? Math.round(daysLogged.reduce((s, d) => s + d.calories, 0) / daysLogged.length)
    : 0;
  const onTarget = daysLogged.filter((d) => d.calories > 0 && d.calories <= goals.calories).length;
  const best = daysLogged.length
    ? daysLogged.reduce((a, b) => (Math.abs(a.calories - goals.calories) < Math.abs(b.calories - goals.calories) ? a : b))
    : null;
  const bestLabel = best
    ? new Date(best.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })
    : "—";

  return (
    <Card style={styles.card}>
      <Text style={type.label}>THIS WEEK</Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.value}>{avg || "—"}</Text>
          <Text style={styles.caption}>avg kcal{"\n"}goal {goals.calories}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.value}>{onTarget}/7</Text>
          <Text style={styles.caption}>days on{"\n"}target</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.value}>{bestLabel}</Text>
          <Text style={styles.caption}>best{"\n"}day</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.value}>🔥 {streak.current}</Text>
          <Text style={styles.caption}>day{"\n"}streak</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  row: { flexDirection: "row", marginTop: 10 },
  stat: { flex: 1, alignItems: "center" },
  value: { fontSize: 20, fontWeight: "800", color: colors.text },
  caption: { fontSize: 10, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
});
