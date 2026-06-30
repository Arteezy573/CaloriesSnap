import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Alert, Dimensions, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import Svg, { Polyline, Polygon, Circle, Text as SvgText } from "react-native-svg";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Segmented from "./ui/Segmented";
import { WeightLog, logWeight } from "../services/api";
import { WeightUnit, kgToLb, lbToKg, formatWeight, computeWeightTrend } from "../services/weight";
import { localDateString } from "../services/dates";
import { colors, radii, spacing, type } from "../theme";

const UNIT_KEY = "weight_unit_pref";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Props {
  logs: WeightLog[];
  onLogged: () => void;
}

export default function WeightCard({ logs, onLogged }: Props) {
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(UNIT_KEY).then((v) => {
      if (v === "kg" || v === "lb") setUnit(v);
    });
  }, []);

  function changeUnit(idx: number) {
    const next: WeightUnit = idx === 0 ? "kg" : "lb";
    setUnit(next);
    AsyncStorage.setItem(UNIT_KEY, next);
  }

  const trend = computeWeightTrend(logs);

  async function handleLog() {
    const parsed = parseFloat(input.replace(",", "."));
    if (!isFinite(parsed) || parsed <= 0) {
      Alert.alert("Enter a weight", "Please enter a valid weight.");
      return;
    }
    const weightKg = unit === "lb" ? lbToKg(parsed) : parsed;
    setSaving(true);
    try {
      await logWeight({ date: localDateString(), weight_kg: weightKg });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInput("");
      onLogged();
    } catch (e: any) {
      Alert.alert("Error", "Could not save weight: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>Weight</Text>
        {trend.latest !== null && (
          <Text style={styles.latest}>{formatWeight(trend.latest, unit)}</Text>
        )}
      </View>

      {trend.change !== null && (
        <Text style={styles.change}>
          {renderChange(trend.change, trend.ratePerWeek, unit)}
        </Text>
      )}

      <WeightChart logs={logs} unit={unit} />

      <View style={styles.unitRow}>
        <View style={styles.unitToggle}>
          <Segmented options={["kg", "lb"]} selectedIndex={unit === "kg" ? 0 : 1} onChange={changeUnit} />
        </View>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={`Today's weight (${unit})`}
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
          value={input}
          onChangeText={setInput}
          returnKeyType="done"
          onSubmitEditing={handleLog}
        />
        <Button title="Log" onPress={handleLog} loading={saving} style={styles.logBtn} />
      </View>
    </Card>
  );
}

function renderChange(changeKg: number, ratePerWeek: number | null, unit: WeightUnit): string {
  const conv = (kg: number) => (unit === "lb" ? kgToLb(kg) : kg);
  const sign = changeKg > 0 ? "+" : "";
  const total = `${sign}${conv(changeKg).toFixed(1)} ${unit}`;
  if (ratePerWeek === null || ratePerWeek === 0) return `${total} this period`;
  const rateSign = ratePerWeek > 0 ? "+" : "";
  return `${total} · ${rateSign}${conv(ratePerWeek).toFixed(1)} ${unit}/wk`;
}

interface ChartProps {
  logs: WeightLog[];
  unit: WeightUnit;
}

function WeightChart({ logs, unit }: ChartProps) {
  if (logs.length === 0) {
    return (
      <Text style={[type.footnote, styles.empty]}>
        No weigh-ins yet. Log your weight to see your trend.
      </Text>
    );
  }

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const data = sorted.map((l) => ({
    date: l.date,
    value: unit === "lb" ? kgToLb(l.weight_kg) : l.weight_kg,
  }));

  const screenWidth = Dimensions.get("window").width;
  const chartW = screenWidth - spacing.l * 2 - spacing.l * 2;
  const chartH = 140;
  const padTop = 16;
  const padBottom = 24;
  const padLeft = 8;
  const padRight = 8;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  // pad the range a touch so a near-flat line isn't pinned to the edges
  const pad = (maxVal - minVal || 1) * 0.15;
  const lo = minVal - pad;
  const range = maxVal + pad - lo || 1;

  const points = data.map((d, i) => {
    const x = padLeft + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = padTop + plotH - ((d.value - lo) / range) * plotH;
    return { x, y, ...d };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const baselineY = padTop + plotH;
  const areaPoints = `${points[0].x},${baselineY} ${polylinePoints} ${points[points.length - 1].x},${baselineY}`;

  const labelCount = Math.min(data.length, 5);
  const labelStep = Math.max(1, Math.floor((data.length - 1) / Math.max(1, labelCount - 1)));
  const labelIndices: number[] = [];
  for (let i = 0; i < data.length; i += labelStep) labelIndices.push(i);
  if (!labelIndices.includes(data.length - 1)) labelIndices.push(data.length - 1);

  return (
    <Svg width={chartW} height={chartH}>
      <Polygon points={areaPoints} fill={colors.fat} opacity={0.12} />
      <Polyline points={polylinePoints} fill="none" stroke={colors.fat} strokeWidth={2} />
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.fat} />
      ))}
      {labelIndices.map((idx) => (
        <SvgText key={idx} x={points[idx].x} y={chartH - 4} fill={colors.textSecondary} fontSize={9} textAnchor="middle">
          {formatShortDate(data[idx].date)}
        </SvgText>
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.m },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontSize: 14, fontWeight: "700", color: colors.fat },
  latest: { ...type.title },
  change: { ...type.footnote, marginTop: 2, marginBottom: spacing.s },
  empty: { textAlign: "center", paddingVertical: spacing.xl },
  unitRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: spacing.s },
  unitToggle: { width: 120 },
  inputRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.m, gap: spacing.s },
  input: {
    flex: 1,
    backgroundColor: colors.fill,
    borderRadius: radii.m,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  logBtn: { paddingHorizontal: spacing.xl },
});
