import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Dimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline, Polygon, Line, Circle, Text as SvgText } from "react-native-svg";
import Card from "../../components/ui/Card";
import Segmented from "../../components/ui/Segmented";
import WeeklyReportCard from "../../components/WeeklyReportCard";
import { HistoryEntry, getHistory, getGoals, Goals } from "../../services/api";
import { localDateString } from "../../services/dates";
import { computeStreak, StreakInfo } from "../../services/streak";
import { colors, spacing, type } from "../../theme";

const RANGES = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateString(d);
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
  const chartW = screenWidth - spacing.l * 2 - spacing.l * 2; // screen - margins - card padding
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
  const baselineY = padTop + plotH;
  const areaPoints = `${points[0].x},${baselineY} ${polylinePoints} ${points[points.length - 1].x},${baselineY}`;

  const labelCount = Math.min(data.length, 5);
  const labelStep = Math.max(1, Math.floor((data.length - 1) / (labelCount - 1)));
  const labelIndices: number[] = [];
  for (let i = 0; i < data.length; i += labelStep) labelIndices.push(i);
  if (!labelIndices.includes(data.length - 1)) labelIndices.push(data.length - 1);

  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return (
    <Card style={chartStyles.card}>
      <View style={chartStyles.cardHeader}>
        <Text style={[chartStyles.cardLabel, { color }]}>{label}</Text>
        <Text style={type.footnote}>
          avg {avg}
          {unit}
        </Text>
      </View>
      <Svg width={chartW} height={chartH}>
        <Polygon points={areaPoints} fill={color} opacity={0.12} />
        {goalValue !== undefined && (
          <>
            <Line
              x1={padLeft}
              y1={padTop + plotH - ((goalValue - minVal) / range) * plotH}
              x2={padLeft + plotW}
              y2={padTop + plotH - ((goalValue - minVal) / range) * plotH}
              stroke={colors.textSecondary}
              strokeDasharray="4,4"
              strokeWidth={1}
            />
            <SvgText
              x={padLeft + plotW}
              y={padTop + plotH - ((goalValue - minVal) / range) * plotH - 4}
              fill={colors.textSecondary}
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
          <SvgText key={idx} x={points[idx].x} y={chartH - 4} fill={colors.textSecondary} fontSize={9} textAnchor="middle">
            {formatShortDate(data[idx].date)}
          </SvgText>
        ))}
      </Svg>
    </Card>
  );
}

const EMPTY_STREAK: StreakInfo = { current: 0, best: 0, todayLogged: false, last7: [false, false, false, false, false, false, false] };

export default function TrendsScreen() {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [week, setWeek] = useState<HistoryEntry[]>([]);
  const [streak, setStreak] = useState<StreakInfo>(EMPTY_STREAK);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeIdx, setRangeIdx] = useState(0);

  async function loadData() {
    try {
      const range = RANGES[rangeIdx];
      const end = localDateString();
      const [h, g, w] = await Promise.all([
        getHistory(daysAgo(range.days - 1), end),
        getGoals(),
        getHistory(daysAgo(6), end),
      ]);
      setHistory(h);
      setGoals(g);
      setWeek(w);
      setStreak(computeStreak(w, end));
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

  if (loading || !goals) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const calData = history.map((h) => ({ date: h.date, value: h.calories }));
  const proteinData = history.map((h) => ({ date: h.date, value: Math.round(h.protein_g) }));
  const carbsData = history.map((h) => ({ date: h.date, value: Math.round(h.carbs_g) }));
  const fatData = history.map((h) => ({ date: h.date, value: Math.round(h.fat_g) }));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.s, paddingHorizontal: spacing.l, paddingBottom: 32 }}
    >
      <Text style={type.largeTitle}>Trends</Text>

      <View style={{ marginTop: spacing.m, marginBottom: spacing.m }}>
        <WeeklyReportCard week={week} goals={goals} streak={streak} />
        <Segmented options={RANGES.map((r) => r.label)} selectedIndex={rangeIdx} onChange={setRangeIdx} />
      </View>

      {history.length === 0 ? (
        <Text style={[type.footnote, { textAlign: "center", marginTop: 40 }]}>
          No data for this period. Start logging meals!
        </Text>
      ) : (
        <>
          <MiniChart data={calData} color={colors.accent} label="Calories" unit=" kcal" goalValue={goals.calories} />
          <MiniChart data={proteinData} color={colors.protein} label="Protein" unit="g" goalValue={goals.protein_g} />
          <MiniChart data={carbsData} color={colors.carbs} label="Carbs" unit="g" goalValue={goals.carbs_g} />
          <MiniChart data={fatData} color={colors.fat} label="Fat" unit="g" goalValue={goals.fat_g} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
});

const chartStyles = StyleSheet.create({
  card: { marginBottom: spacing.m },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.s },
  cardLabel: { fontSize: 14, fontWeight: "700" },
});
