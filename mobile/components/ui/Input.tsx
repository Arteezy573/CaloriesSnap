import { View, Text, TextInput, StyleSheet, TextInputProps } from "react-native";
import { colors, radii, type } from "../../theme";

interface Props extends TextInputProps {
  label?: string;
}

export default function Input({ label, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textSecondary}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { ...type.label, marginBottom: 6, marginLeft: 4 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.m,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
});
