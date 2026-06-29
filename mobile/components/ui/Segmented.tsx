import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, radii, shadow } from "../../theme";

interface Props {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export default function Segmented({ options, selectedIndex, onChange }: Props) {
  return (
    <View style={styles.track}>
      {options.map((label, i) => (
        <TouchableOpacity
          key={label}
          style={[styles.segment, i === selectedIndex && styles.segmentActive]}
          onPress={() => onChange(i)}
          activeOpacity={0.8}
        >
          <Text style={[styles.text, i === selectedIndex && styles.textActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.separator,
    borderRadius: radii.s + 1,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: radii.s - 1,
  },
  segmentActive: { backgroundColor: colors.card, ...shadow.card },
  text: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  textActive: { color: colors.text },
});
