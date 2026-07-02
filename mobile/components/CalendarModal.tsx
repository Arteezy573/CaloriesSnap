import { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Card from "./ui/Card";
import { getHistory, HistoryEntry } from "../services/api";
import { localDateString } from "../services/dates";
import { buildMonthGrid, calorieBucket, CalorieBucket } from "../services/calendar";
import { colors, radii, spacing, type } from "../theme";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const BUCKET_FILL: Record<CalorieBucket, string> = {
  under: colors.underSoft,
  on: colors.accentSoft,
  over: colors.warningSoft,
  none: "transparent",
};

const BUCKET_TEXT: Record<CalorieBucket, string> = {
  under: colors.fat,
  on: colors.accent,
  over: colors.overGoal,
  none: colors.text,
};

interface Props {
  visible: boolean;
  selectedDate: string;
  goalCalories: number;
  onSelectDate: (date: string) => void;
  onClose: () => void;
}

export default function CalendarModal({ visible, selectedDate, goalCalories, onSelectDate, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const today = localDateString();
  // Visible month, initialized from the selected date.
  const [year, setYear] = useState(() => Number(selectedDate.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(selectedDate.slice(5, 7)) - 1); // 0-indexed
  const [calByDate, setCalByDate] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Re-sync to the selected date each time the modal opens.
  useEffect(() => {
    if (visible) {
      setYear(Number(selectedDate.slice(0, 4)));
      setMonth(Number(selectedDate.slice(5, 7)) - 1);
    }
  }, [visible, selectedDate]);

  // Fetch this month's history whenever the visible month changes while open.
  useEffect(() => {
    if (!visible) return;
    let ignore = false;
    const grid = buildMonthGrid(year, month);
    const flat = grid.flat().filter((c): c is string => c !== null);
    const start = flat[0];
    const end = flat[flat.length - 1];
    setLoading(true);
    getHistory(start, end)
      .then((entries: HistoryEntry[]) => {
        if (ignore) return;
        const map: Record<string, number> = {};
        for (const e of entries) map[e.date] = e.calories;
        setCalByDate(map);
      })
      .catch(() => {
        if (!ignore) setCalByDate({});
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [visible, year, month]);

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  const weeks = buildMonthGrid(year, month);
  const canGoForward = new Date(year, month, 1) < new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.s }]}>
        <View style={styles.header}>
          <Text style={type.title}>Calendar</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={12} style={styles.arrow}>
            <Ionicons name="chevron-back" size={22} color={colors.accent} />
          </TouchableOpacity>
          <Text style={type.headline}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity onPress={() => canGoForward && shiftMonth(1)} hitSlop={12} style={styles.arrow} disabled={!canGoForward}>
            <Ionicons name="chevron-forward" size={22} color={canGoForward ? colors.accent : colors.separator} />
          </TouchableOpacity>
        </View>

        <Card style={styles.gridCard}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={styles.weekdayLabel}>{d}</Text>
            ))}
          </View>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ paddingVertical: spacing.xl }} />
          ) : (
            weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((cell, ci) => {
                  if (cell === null) return <View key={ci} style={styles.dayCell} />;
                  const isFuture = cell > today;
                  const bucket = calorieBucket(calByDate[cell] ?? 0, goalCalories);
                  const isSelected = cell === selectedDate;
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={styles.dayCell}
                      disabled={isFuture}
                      onPress={() => onSelectDate(cell)}
                      activeOpacity={0.6}
                    >
                      <View
                        style={[
                          styles.dayInner,
                          { backgroundColor: BUCKET_FILL[bucket] },
                          isSelected && styles.daySelected,
                        ]}
                      >
                        <Text style={[styles.dayNum, { color: isFuture ? colors.separator : BUCKET_TEXT[bucket] }]}>
                          {Number(cell.slice(8, 10))}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </Card>

        <View style={styles.legend}>
          <LegendDot color={colors.underSoft} label="Under" />
          <LegendDot color={colors.accentSoft} label="On target" />
          <LegendDot color={colors.warningSoft} label="Over" />
        </View>
      </View>
    </Modal>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={type.footnote}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.l },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.l },
  arrow: { padding: spacing.s },
  gridCard: { marginTop: spacing.m, paddingVertical: spacing.m },
  weekRow: { flexDirection: "row" },
  weekdayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.s },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 2 },
  dayInner: { width: "100%", height: "100%", borderRadius: radii.s, alignItems: "center", justifyContent: "center" },
  daySelected: { borderWidth: 2, borderColor: colors.accent },
  dayNum: { fontSize: 15, fontWeight: "600" },
  legend: { flexDirection: "row", justifyContent: "center", gap: spacing.l, marginTop: spacing.l },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
});
