import { View, Text, StyleSheet } from "react-native";

interface Props {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
}

export default function MacroBar({ label, current, goal, color, unit = "g" }: Props) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>
        {Math.round(current)}{unit}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.goal}>/ {goal}{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1 },
  label: { fontSize: 11, color: "#888", marginBottom: 4 },
  value: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  track: { width: 60, height: 4, backgroundColor: "#333", borderRadius: 2 },
  fill: { height: 4, borderRadius: 2 },
  goal: { fontSize: 10, color: "#666", marginTop: 4 },
});
