import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { useSharedValue, useAnimatedProps, withSpring } from "react-native-reanimated";
import { colors } from "../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  consumed: number;
  goal: number;
  size?: number;
}

export default function CalorieRing({ consumed, goal, size = 150 }: Props) {
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  const over = goal > 0 && consumed > goal;
  const fraction = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const remaining = Math.max(goal - consumed, 0);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(fraction, { damping: 18, stiffness: 90 });
  }, [fraction, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.separator}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? colors.overGoal : colors.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.big}>{over ? consumed - goal : remaining}</Text>
        <Text style={styles.small}>{over ? "kcal over" : "kcal left"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", alignItems: "center" },
  big: { fontSize: 28, fontWeight: "800", color: colors.text },
  small: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
