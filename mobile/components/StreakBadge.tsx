import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from "react-native";
import { colors, radii, shadow, type } from "../theme";
import { StreakInfo } from "../services/streak";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  streak: StreakInfo;
}

export default function StreakBadge({ streak }: Props) {
  const [open, setOpen] = useState(false);

  // Day letters for the last7 window (oldest-first, ending today).
  const todayDow = new Date().getDay();
  const letters = Array.from({ length: 7 }, (_, i) => DAY_LETTERS[(todayDow - 6 + i + 7) % 7]);

  return (
    <>
      <TouchableOpacity style={styles.badge} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={styles.badgeText}>🔥 {streak.current}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>🔥 {streak.current}-day streak</Text>
            <Text style={styles.subtitle}>
              Best: {streak.best} day{streak.best === 1 ? "" : "s"}
              {streak.todayLogged ? " · Today logged ✓" : " · Log a meal to keep it going"}
            </Text>
            <View style={styles.dotsRow}>
              {streak.last7.map((logged, i) => (
                <View key={i} style={styles.dotCol}>
                  <View style={[styles.dot, logged && styles.dotOn]} />
                  <Text style={styles.dotLabel}>{letters[i]}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    ...shadow.card,
  },
  badgeText: { fontSize: 14, fontWeight: "700", color: colors.text },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radii.l,
    padding: 24,
    alignItems: "center",
    alignSelf: "stretch",
  },
  title: { ...type.title },
  subtitle: { ...type.footnote, marginTop: 6 },
  dotsRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  dotCol: { alignItems: "center", gap: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.separator },
  dotOn: { backgroundColor: colors.streak },
  dotLabel: { fontSize: 10, color: colors.textSecondary },
});
