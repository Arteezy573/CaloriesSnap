import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "../theme";

interface Props {
  label: string;
  current: number;
  goal: number;
  color: string;
}

export default function MacroPill({ label, current, goal, color }: Props) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  return (
    <View style={styles.pill}>
      <Text style={[styles.label, { color }]}>{label.toUpperCase()}</Text>
      <Text style={styles.value}>
        {Math.round(current)}/{goal}g
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    backgroundColor: colors.fill,
    borderRadius: radii.m - 2,
    padding: 8,
  },
  label: { fontSize: 10, fontWeight: "700" },
  value: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 2 },
  track: { height: 3, backgroundColor: colors.separator, borderRadius: 2, marginTop: 5 },
  fill: { height: 3, borderRadius: 2 },
});
