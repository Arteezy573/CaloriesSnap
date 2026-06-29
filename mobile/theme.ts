// Design tokens — iOS system palette, Apple Health-style light theme.
// All screens/components import from here; no hex literals elsewhere.

export const colors = {
  background: "#F2F2F7",
  card: "#FFFFFF",
  separator: "#E5E5EA",
  fill: "#F2F2F7", // inset tiles on white cards

  accent: "#34C759", // green — ring, primary buttons
  accentSoft: "#E8F5E9",
  warningSoft: "#FFF4E0",
  tipText: "#2E7D32",
  overGoal: "#FF9500", // amber ring when over goal (never red)

  protein: "#FF3B30",
  carbs: "#FF9500",
  fat: "#007AFF",
  streak: "#FF9500",
  destructive: "#FF3B30",

  text: "#000000",
  textSecondary: "#8E8E93",
  textOnAccent: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  s: 8,
  m: 12,
  l: 16,
  pill: 999,
};

export const type = {
  largeTitle: { fontSize: 34, fontWeight: "800" as const, letterSpacing: -0.5, color: colors.text },
  title: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  headline: { fontSize: 17, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 17, fontWeight: "400" as const, color: colors.text },
  footnote: { fontSize: 13, color: colors.textSecondary },
  label: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.6,
    color: colors.textSecondary,
    textTransform: "uppercase" as const,
  },
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
};
