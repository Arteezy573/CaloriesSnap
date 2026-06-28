import { View, StyleSheet, ViewProps } from "react-native";
import { colors, radii, spacing, shadow } from "../../theme";

export default function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.l,
    padding: spacing.l,
    ...shadow.card,
  },
});
