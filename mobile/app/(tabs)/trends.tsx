import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "expo-router";
import Svg, { Polyline, Line, Circle, Text as SvgText } from "react-native-svg";
import { HistoryEntry, getHistory, getGoals, Goals } from "../../services/api";

const RANGES = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
];

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface ChartProps {
  data: { date: string; value: number }[];
  color: string;
  label: string;
  unit: string;
  goalValue?: number;
}

function MiniChart({ data, color, label, unit, goalValue }: ChartProps) {
  if (data.length === 0) return null;

  const screenWidth = Dimensions.get("window").width;
  const chartW = screenWidth - 64;
  const chartH = 140;
  const padTop = 20;
  const padBottom = 24;
  const padLeft = 8;
  const padRight = 8;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;

  const values = data.map((d) => d.value);
  const allValues = goalValue ? [...values, goalValue] : values;
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = padLeft + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = padTop + plotH - ((d.value - minVal) / range) * plotH;
    return { x, y, ...d };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  const labelCount = Math.min(data.length, 5);
  const labelStep = Math.max(1, Math.floor((data.length - 1) / (labelCount - 1)));
  const labelIndices: number[] = [];
  for (let i = 0; i < data.length; i += labelStep) labelIndices.push(i);
  if (!labelIndices.includes(data.length - 1)) labelIndices.push(data.length - 1);

  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return (
    <View style={chartStyles.card}>
      <View style={chartStyles.cardHeader}>
        <Text style={[chartStyles.cardLabel, { color }]}>{label}</Text>
        <Text style={chartStyles.avg}>avg: {avg}{unit}</Text>
      </View>
      <Svg width={chartW} height={chartH}>
        {goalValue !== undefined && (
          <>
            <Line
              x1={padLeft}
              y1={padTop + plotH - ((goalValue - minVal) / range) * plotH}
              x2={padLeft + plotW}
              y2={padTop + plotH - ((goalValue - minVal) / range) * plotH}
              stroke="#555"
              strokeDasharray="4,4"
              strokeWidth={1}
            />
            <SvgText
              x={padLeft + plotW}
              y={padTop + plotH - ((goalValue - minVal) / range) * plotH - 4}
              fill="#666"
              fontSize={9}
              textAnchor="end"
            >
              Goal: {goalValue}
            </SvgText>
          </>
        )}
        <Polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
        {labelIndices.map((idx) => (
          <SvgText
            key={idx}
            x={points[idx].x}
            y={chartH - 4}
            fill="#666"
            fontSize={9}
            textAnchor="middle"
          >
            {formatShortDate(data[idx].date)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

export default function TrendsScreen() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeIdx, setRangeIdx] = useState(0);

  async function loadData() {
    try {
      const range = RANGES[rangeIdx];
      const start = daysAgo(range.days - 1);
      const end = toISO(new Date());
      const [h, g] = await Promise.all([getHistory(start, end), getGoals()]);
      setHistory(h);
      setGoals(g);
    } catch (e: any) {
      Alert.alert("Error", "Could not load history: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [rangeIdx])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4ecdc4" size="large" />
      </View>
    );
  }

  const calData = history.map((h) => ({ date: h.date, value: h.calories }));
  const proteinData = history.map((h) => ({ date: h.date, value: Math.round(h.protein_g) }));
  const carbsData = history.map((h) => ({ date: h.date, value: Math.round(h.carbs_g) }));
  const fatData = history.map((h) => ({ date: h.date, value: Math.round(h.fat_g) }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Trends</Text>

      <View style={styles.rangeRow}>
        {RANGES.map((r, i) => (
          <TouchableOpacity
            key={r.label}
            style={[styles.rangeBtn, i === rangeIdx && styles.rangeBtnActive]}
            onPress={() => setRangeIdx(i)}
          >
            <Text style={[styles.rangeBtnText, i === rangeIdx && styles.rangeBtnTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {history.length === 0 ? (
        <Text style={styles.emptyText}>No data for this period. Start logging meals!</Text>
      ) : (
        <>
          <MiniChart data={calData} color="#4ecdc4" label="Calories" unit=" kcal" goalValue={goals?.calories} />
          <MiniChart data={proteinData} color="#ff6b6b" label="Protein" unit="g" goalValue={goals?.protein_g} />
          <MiniChart data={carbsData} color="#f7dc6f" label="Carbs" unit="g" goalValue={goals?.carbs_g} />
          <MiniChart data={fatData} color="#45b7d1" label="Fat" unit="g" goalValue={goals?.fat_g} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, backgroundColor: "#0f0f1a", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 16 },
  rangeRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  rangeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1e1e36",
  },
  rangeBtnActive: { backgroundColor: "#4ecdc4" },
  rangeBtnText: { color: "#888", fontSize: 14, fontWeight: "600" },
  rangeBtnTextActive: { color: "#000" },
  emptyText: { color: "#666", fontSize: 14, textAlign: "center", marginTop: 40 },
});

const chartStyles = StyleSheet.create({
  card: {
    backgroundColor: "#1e1e36",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardLabel: { fontSize: 14, fontWeight: "bold" },
  avg: { fontSize: 12, color: "#888" },
});
