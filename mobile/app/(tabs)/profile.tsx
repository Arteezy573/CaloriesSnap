import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert, ActivityIndicator, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";
import { getGoals, updateGoals } from "../../services/api";
import { clearToken, notifyAuthChange } from "../../services/auth";
import { colors, spacing, type } from "../../theme";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleLogout() {
    await clearToken();
    notifyAuthChange(false);
  }

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    try {
      const goals = await getGoals();
      setCalories(String(goals.calories));
      setProtein(String(goals.protein_g));
      setCarbs(String(goals.carbs_g));
      setFat(String(goals.fat_g));
    } catch (e: any) {
      Alert.alert("Error", "Could not load goals: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateGoals({
        calories: parseInt(calories) || 0,
        protein_g: parseInt(protein) || 0,
        carbs_g: parseInt(carbs) || 0,
        fat_g: parseInt(fat) || 0,
      });
      showToast("Goals updated ✓");
    } catch (e: any) {
      Alert.alert("Error", "Could not save goals: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.s, paddingHorizontal: spacing.l, paddingBottom: 40 }}
    >
      <Text style={type.largeTitle}>Profile</Text>

      <Text style={[type.label, styles.sectionLabel]}>DAILY GOALS</Text>
      <Card>
        <Input label="Calories" value={calories} onChangeText={setCalories} keyboardType="numeric" placeholder="kcal" />
        <Input label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="grams" />
        <Input label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="numeric" placeholder="grams" />
        <Input label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="numeric" placeholder="grams" />
        <Button title="Save goals" onPress={handleSave} loading={saving} />
      </Card>

      <Text style={[type.label, styles.sectionLabel]}>PLAN</Text>
      <Card style={{ padding: 0 }}>
        <TouchableOpacity style={styles.row} onPress={() => router.push("/onboarding")} activeOpacity={0.6}>
          <Ionicons name="sparkles-outline" size={20} color={colors.accent} />
          <Text style={styles.rowText}>Recalculate my goals</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </Card>

      <Text style={[type.label, styles.sectionLabel]}>ACCOUNT</Text>
      <Card style={{ padding: 0 }}>
        <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.6}>
          <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
          <Text style={[styles.rowText, { color: colors.destructive }]}>Log Out</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.s, marginLeft: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.m, padding: spacing.l },
  rowText: { flex: 1, fontSize: 16, fontWeight: "500", color: colors.text },
});
