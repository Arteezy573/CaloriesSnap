import { Text, TouchableOpacity, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { colors, radii, spacing } from "../../theme";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "filled" | "tinted" | "plain" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export default function Button({ title, onPress, variant = "filled", disabled, loading, style }: Props) {
  const isPlain = variant === "plain";
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === "filled" ? colors.textOnAccent : colors.accent} />
      ) : (
        <Text style={[styles.text, textStyles[variant]]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.m,
    paddingVertical: 14,
    paddingHorizontal: spacing.l,
    alignItems: "center",
    justifyContent: "center",
  },
  filled: { backgroundColor: colors.accent },
  tinted: { backgroundColor: colors.fill },
  plain: { backgroundColor: "transparent", paddingVertical: spacing.s },
  destructive: { backgroundColor: colors.fill },
  disabled: { opacity: 0.5 },
  text: { fontSize: 16, fontWeight: "600" },
});

const textStyles = StyleSheet.create({
  filled: { color: colors.textOnAccent, fontWeight: "700" },
  tinted: { color: colors.accent },
  plain: { color: colors.accent },
  destructive: { color: colors.destructive },
});
