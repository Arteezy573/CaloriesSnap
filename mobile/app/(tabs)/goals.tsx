import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { getGoals, updateGoals } from "../../services/api";

export default function GoalsScreen() {
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      Alert.alert("Saved", "Daily goals updated.");
    } catch (e: any) {
      Alert.alert("Error", "Could not save goals: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#4ecdc4" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Daily Goals</Text>

      <Text style={styles.label}>DAILY CALORIES</Text>
      <TextInput
        style={styles.input}
        value={calories}
        onChangeText={setCalories}
        keyboardType="numeric"
        placeholderTextColor="#666"
        placeholder="kcal"
      />

      <Text style={[styles.label, { color: "#ff6b6b" }]}>PROTEIN</Text>
      <TextInput
        style={styles.input}
        value={protein}
        onChangeText={setProtein}
        keyboardType="numeric"
        placeholderTextColor="#666"
        placeholder="grams"
      />

      <Text style={[styles.label, { color: "#f7dc6f" }]}>CARBS</Text>
      <TextInput
        style={styles.input}
        value={carbs}
        onChangeText={setCarbs}
        keyboardType="numeric"
        placeholderTextColor="#666"
        placeholder="grams"
      />

      <Text style={[styles.label, { color: "#45b7d1" }]}>FAT</Text>
      <TextInput
        style={styles.input}
        value={fat}
        onChangeText={setFat}
        keyboardType="numeric"
        placeholderTextColor="#666"
        placeholder="grams"
      />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Saving..." : "Save Goals"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 24 },
  label: { fontSize: 12, color: "#888", marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: "#1e1e36",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#4ecdc4",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 32,
  },
  buttonText: { color: "#000", fontSize: 16, fontWeight: "bold" },
});
