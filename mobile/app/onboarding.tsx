import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { buildPlan, Plan, Sex, Activity, GoalDirection, Pace } from "../services/tdee";
import { updateGoals } from "../services/api";
import { PENDING_ONBOARDING_KEY } from "./_layout";
import { colors, radii, spacing, type } from "../theme";

type Step = "sex" | "age" | "height" | "weight" | "activity" | "direction" | "pace" | "building" | "result";

const STEP_ORDER: Step[] = ["sex", "age", "height", "weight", "activity", "direction", "pace", "building", "result"];

interface OptionDef<T extends string> {
  value: T;
  title: string;
  subtitle?: string;
}

const SEX_OPTIONS: OptionDef<Sex>[] = [
  { value: "male", title: "Male" },
  { value: "female", title: "Female" },
];

const ACTIVITY_OPTIONS: OptionDef<Activity>[] = [
  { value: "sedentary", title: "Sedentary", subtitle: "Desk job, little exercise" },
  { value: "light", title: "Lightly active", subtitle: "Exercise 1–3 days/week" },
  { value: "moderate", title: "Moderately active", subtitle: "Exercise 3–5 days/week" },
  { value: "active", title: "Very active", subtitle: "Exercise 6–7 days/week" },
];

const DIRECTION_OPTIONS: OptionDef<GoalDirection>[] = [
  { value: "lose", title: "Lose weight" },
  { value: "maintain", title: "Maintain" },
  { value: "gain", title: "Gain muscle" },
];

const PACE_OPTIONS: OptionDef<Pace>[] = [
  { value: "relaxed", title: "Relaxed", subtitle: "±250 kcal/day · gentler" },
  { value: "standard", title: "Standard", subtitle: "±500 kcal/day · ~0.5 kg per week" },
];

function OptionList<T extends string>({ options, selected, onSelect, onNext }: { options: OptionDef<T>[]; selected: T | null; onSelect: (v: T) => void; onNext: () => void }) {
  return (
    <View style={{ gap: spacing.m }}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.value}
          style={[styles.option, selected === o.value && styles.optionSelected]}
          onPress={() => {
            onSelect(o.value);
            Haptics.selectionAsync();
            setTimeout(onNext, 180);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.optionTitle}>{o.title}</Text>
          {o.subtitle ? <Text style={type.footnote}>{o.subtitle}</Text> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function NumericStep({ label, value, onChange, placeholder, unit, onNext }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; unit: string; onNext: () => void }) {
  return (
    <View>
      <Input label={`${label} (${unit})`} value={value} onChangeText={onChange} keyboardType="numeric" placeholder={placeholder} autoFocus />
      <Button title="Continue" onPress={onNext} disabled={!value.trim()} />
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stepIdx, setStepIdx] = useState(0);
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState<Activity | null>(null);
  const [direction, setDirection] = useState<GoalDirection | null>(null);
  const [pace, setPace] = useState<Pace | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const step = STEP_ORDER[stepIdx];
  const progress = (stepIdx + 1) / STEP_ORDER.length;

  async function finish() {
    await AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
    router.replace("/(tabs)");
  }

  function next() {
    setStepIdx((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  }

  function back() {
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  // "building" auto-computes the plan then advances.
  useEffect(() => {
    if (step !== "building") return;
    const timer = setTimeout(() => {
      // Maintain is a valid direction even without a pace choice; default pace standard.
      const computed = buildPlan({
        sex: sex ?? "male",
        age: parseInt(age) || 30,
        heightCm: parseInt(height) || 170,
        weightKg: parseFloat(weight) || 70,
        activity: activity ?? "moderate",
        direction: direction ?? "maintain",
        pace: pace ?? "standard",
      });
      setPlan(computed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      next();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally depend only on `step`; answer state is read at fire time, not tracked.
  }, [step]);

  async function savePlan() {
    if (!plan) return;
    setSaving(true);
    try {
      await updateGoals(plan);
      await finish();
    } catch (e: any) {
      Alert.alert("Error", "Could not save your plan: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  const QUESTION_TITLES: Record<Step, string> = {
    sex: "What's your biological sex?",
    age: "How old are you?",
    height: "How tall are you?",
    weight: "What's your current weight?",
    activity: "How active are you?",
    direction: "What's your goal?",
    pace: "How fast do you want to get there?",
    building: "Building your plan…",
    result: "Your personalized plan",
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ paddingTop: insets.top + spacing.m, paddingHorizontal: spacing.l, flex: 1 }}>
        <View style={styles.topBar}>
          {stepIdx > 0 && step !== "building" && step !== "result" ? (
            <TouchableOpacity onPress={back} hitSlop={12}>
              <Text style={styles.topBarLink}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          {step !== "result" && (
            <TouchableOpacity onPress={finish} hitSlop={12}>
              <Text style={styles.topBarLink}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <Text style={[type.title, { marginTop: spacing.xl, marginBottom: spacing.xl }]}>{QUESTION_TITLES[step]}</Text>

        {step === "sex" && <OptionList options={SEX_OPTIONS} selected={sex} onSelect={setSex} onNext={next} />}
        {step === "age" && <NumericStep label="Age" value={age} onChange={setAge} placeholder="e.g. 30" unit="years" onNext={next} />}
        {step === "height" && <NumericStep label="Height" value={height} onChange={setHeight} placeholder="e.g. 175" unit="cm" onNext={next} />}
        {step === "weight" && <NumericStep label="Weight" value={weight} onChange={setWeight} placeholder="e.g. 70" unit="kg" onNext={next} />}
        {step === "activity" && <OptionList options={ACTIVITY_OPTIONS} selected={activity} onSelect={setActivity} onNext={next} />}
        {step === "direction" && <OptionList options={DIRECTION_OPTIONS} selected={direction} onSelect={setDirection} onNext={next} />}
        {step === "pace" && <OptionList options={PACE_OPTIONS} selected={pace} onSelect={setPace} onNext={next} />}

        {step === "building" && (
          <View style={styles.buildingBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[type.footnote, { marginTop: spacing.l }]}>Crunching the numbers with Mifflin-St Jeor…</Text>
          </View>
        )}

        {step === "result" && plan && (
          <View>
            <Card style={{ alignItems: "center" }}>
              <Text style={styles.planCalories}>{plan.calories}</Text>
              <Text style={type.footnote}>kcal per day</Text>
              <View style={styles.planMacros}>
                <View style={styles.planMacro}>
                  <Text style={[styles.planMacroValue, { color: colors.protein }]}>{plan.protein_g}g</Text>
                  <Text style={type.footnote}>protein</Text>
                </View>
                <View style={styles.planMacro}>
                  <Text style={[styles.planMacroValue, { color: colors.carbs }]}>{plan.carbs_g}g</Text>
                  <Text style={type.footnote}>carbs</Text>
                </View>
                <View style={styles.planMacro}>
                  <Text style={[styles.planMacroValue, { color: colors.fat }]}>{plan.fat_g}g</Text>
                  <Text style={type.footnote}>fat</Text>
                </View>
              </View>
            </Card>
            <Text style={[type.footnote, { textAlign: "center", marginTop: spacing.m }]}>
              You can adjust these anytime in Profile.
            </Text>
            <Button title="Looks good — let's go" onPress={savePlan} loading={saving} style={{ marginTop: spacing.l }} />
            <Button title="Keep my current goals" variant="plain" onPress={finish} style={{ marginTop: spacing.s }} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.m },
  topBarLink: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  progressTrack: { height: 4, backgroundColor: colors.separator, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
  option: {
    backgroundColor: colors.card,
    borderRadius: radii.l,
    padding: spacing.l,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionSelected: { borderColor: colors.accent },
  optionTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  buildingBox: { alignItems: "center", marginTop: spacing.xxl },
  planCalories: { fontSize: 44, fontWeight: "800", color: colors.text },
  planMacros: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.l },
  planMacro: { alignItems: "center" },
  planMacroValue: { fontSize: 20, fontWeight: "800" },
});
