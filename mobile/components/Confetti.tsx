import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors } from "../theme";

const PIECE_COLORS = [colors.accent, colors.protein, colors.carbs, colors.fat, colors.streak];
const PIECE_COUNT = 14;

function Piece({ index }: { index: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [t]);

  const angle = (index / PIECE_COUNT) * Math.PI * 2;
  const distance = 70 + (index % 3) * 25;

  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * distance * t.value },
      { translateY: Math.sin(angle) * distance * t.value + 50 * t.value * t.value },
      { rotate: `${t.value * 360}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        { backgroundColor: PIECE_COLORS[index % PIECE_COLORS.length] },
        style,
      ]}
    />
  );
}

export default function Confetti() {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      {Array.from({ length: PIECE_COUNT }, (_, i) => (
        <Piece key={i} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  piece: { position: "absolute", width: 8, height: 12, borderRadius: 2 },
});
