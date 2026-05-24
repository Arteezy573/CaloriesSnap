import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import FoodItemRow from "../../components/FoodItemRow";
import {
  FoodItem,
  AnalyzeResponse,
  SavedMeal,
  analyzePhoto,
  analyzeText,
  createMeal,
  saveMealForLater,
  getSavedMeals,
  deleteSavedMeal,
} from "../../services/api";

type Mode = "camera" | "results" | "manual" | "saved";

export default function SnapScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("camera");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [confidence, setConfidence] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState(false);

  const [foodName, setFoodName] = useState("");
  const [manCalories, setManCalories] = useState("");
  const [manProtein, setManProtein] = useState("");
  const [manCarbs, setManCarbs] = useState("");
  const [manFat, setManFat] = useState("");
  const [estimating, setEstimating] = useState(false);

  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setAnalyzing(true);
      try {
        const analysis = await analyzePhoto(uri);
        setFoods(analysis.foods);
        setConfidence(analysis.confidence);
        setMode("results");
      } catch (e: any) {
        Alert.alert("Analysis failed", e.message + "\n\nYou can try again or enter manually.");
      } finally {
        setAnalyzing(false);
      }
    }
  }

  async function handleSaveMeal() {
    setSaving(true);
    try {
      await createMeal({ source: "photo", foods, image_path: imageUri ?? undefined });
      Alert.alert("Saved!", "Meal added to your log.");
      resetState();
      router.navigate("/");
    } catch (e: any) {
      Alert.alert("Error", "Could not save meal: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveForLater() {
    const mealName = foods.map((f) => f.name).join(", ");
    Alert.prompt
      ? Alert.prompt("Save for Later", "Give this meal a name:", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: (name) => doSaveForLater(name || mealName),
          },
        ], "plain-text", mealName)
      : doSaveForLater(mealName);
  }

  async function doSaveForLater(name: string) {
    try {
      await saveMealForLater(name, foods);
      Alert.alert("Saved!", "Meal saved for later.");
    } catch (e: any) {
      Alert.alert("Error", "Could not save: " + e.message);
    }
  }

  async function handleEstimate() {
    if (!foodName.trim()) return;
    setEstimating(true);
    try {
      const result = await analyzeText(foodName);
      if (result.foods.length > 0) {
        const f = result.foods[0];
        setManCalories(String(f.calories));
        setManProtein(String(f.protein_g));
        setManCarbs(String(f.carbs_g));
        setManFat(String(f.fat_g));
      }
    } catch (e: any) {
      Alert.alert("Error", "Could not estimate: " + e.message);
    } finally {
      setEstimating(false);
    }
  }

  async function handleSaveManual() {
    if (!foodName.trim()) {
      Alert.alert("Missing", "Enter a food name.");
      return;
    }
    setSaving(true);
    try {
      await createMeal({
        source: "manual",
        foods: [
          {
            name: foodName,
            quantity: "1 serving",
            calories: parseInt(manCalories) || 0,
            protein_g: parseFloat(manProtein) || 0,
            carbs_g: parseFloat(manCarbs) || 0,
            fat_g: parseFloat(manFat) || 0,
          },
        ],
      });
      Alert.alert("Saved!", "Meal added to your log.");
      resetState();
      router.navigate("/");
    } catch (e: any) {
      Alert.alert("Error", "Could not save meal: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function openSavedMeals() {
    setMode("saved");
    setLoadingSaved(true);
    try {
      const meals = await getSavedMeals();
      setSavedMeals(meals);
    } catch (e: any) {
      Alert.alert("Error", "Could not load saved meals: " + e.message);
    } finally {
      setLoadingSaved(false);
    }
  }

  async function searchSaved(query: string) {
    setSearchQuery(query);
    try {
      const meals = await getSavedMeals(query || undefined);
      setSavedMeals(meals);
    } catch (e: any) {
      // silently fail search
    }
  }

  async function logSavedMeal(meal: SavedMeal) {
    setSaving(true);
    try {
      await createMeal({ source: "manual", foods: meal.foods });
      Alert.alert("Saved!", `"${meal.name}" added to your log.`);
      resetState();
      router.navigate("/");
    } catch (e: any) {
      Alert.alert("Error", "Could not log meal: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSaved(meal: SavedMeal) {
    Alert.alert("Delete", `Remove "${meal.name}" from saved meals?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSavedMeal(meal.id);
            setSavedMeals((prev) => prev.filter((m) => m.id !== meal.id));
          } catch (e: any) {
            Alert.alert("Error", "Could not delete: " + e.message);
          }
        },
      },
    ]);
  }

  function resetState() {
    setMode("camera");
    setImageUri(null);
    setFoods([]);
    setConfidence("");
    setEditable(false);
    setFoodName("");
    setManCalories("");
    setManProtein("");
    setManCarbs("");
    setManFat("");
    setSearchQuery("");
    setSavedMeals([]);
  }

  function updateFood(index: number, updated: FoodItem) {
    setFoods((prev) => prev.map((f, i) => (i === index ? updated : f)));
  }

  const totalCalories = foods.reduce((sum, f) => sum + f.calories, 0);

  if (mode === "saved") {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Saved Meals</Text>
          <TextInput
            style={styles.input}
            value={searchQuery}
            onChangeText={searchSaved}
            placeholder="Search saved meals..."
            placeholderTextColor="#666"
          />
        </View>
        {loadingSaved ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#4ecdc4" size="large" />
          </View>
        ) : savedMeals.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyText}>
              {searchQuery ? "No meals match your search." : "No saved meals yet."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={savedMeals}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            renderItem={({ item }) => (
              <View style={styles.savedCard}>
                <TouchableOpacity style={styles.savedInfo} onPress={() => logSavedMeal(item)}>
                  <Text style={styles.savedName}>{item.name}</Text>
                  <Text style={styles.savedDetail}>
                    {item.foods.length} item{item.foods.length !== 1 ? "s" : ""} · {item.total_calories} kcal
                  </Text>
                  <Text style={styles.savedFoods} numberOfLines={1}>
                    {item.foods.map((f) => f.name).join(", ")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSaved(item)} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>×</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
        <View style={styles.content}>
          <TouchableOpacity onPress={() => setMode("camera")} style={styles.switchLink}>
            <Text style={styles.switchText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === "manual") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add Food Manually</Text>

        <Text style={styles.label}>FOOD NAME</Text>
        <TextInput
          style={styles.input}
          value={foodName}
          onChangeText={setFoodName}
          placeholder="e.g. Apple, Greek Yogurt..."
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>CALORIES</Text>
        <TextInput
          style={styles.input}
          value={manCalories}
          onChangeText={setManCalories}
          keyboardType="numeric"
          placeholder="kcal"
          placeholderTextColor="#666"
        />

        <View style={styles.macroRow}>
          <View style={styles.macroField}>
            <Text style={[styles.label, { color: "#ff6b6b" }]}>PROTEIN</Text>
            <TextInput
              style={styles.input}
              value={manProtein}
              onChangeText={setManProtein}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor="#666"
            />
          </View>
          <View style={styles.macroField}>
            <Text style={[styles.label, { color: "#f7dc6f" }]}>CARBS</Text>
            <TextInput
              style={styles.input}
              value={manCarbs}
              onChangeText={setManCarbs}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor="#666"
            />
          </View>
          <View style={styles.macroField}>
            <Text style={[styles.label, { color: "#45b7d1" }]}>FAT</Text>
            <TextInput
              style={styles.input}
              value={manFat}
              onChangeText={setManFat}
              keyboardType="numeric"
              placeholder="g"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        <View style={styles.tip}>
          <Text style={styles.tipText}>
            Just type the food name and tap "Estimate" — AI will fill in the numbers
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.estimateBtn}
            onPress={handleEstimate}
            disabled={estimating}
          >
            <Text style={styles.estimateBtnText}>
              {estimating ? "Estimating..." : "Estimate"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveManual}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setMode("camera")} style={styles.switchLink}>
          <Text style={styles.switchText}>Use camera instead</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (mode === "results") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}

        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>AI Analysis Result</Text>
          {confidence === "low" && (
            <View style={styles.warningBadge}>
              <Text style={styles.warningText}>Low confidence — please review</Text>
            </View>
          )}
        </View>

        {foods.map((food, i) => (
          <FoodItemRow key={i} item={food} index={i} onUpdate={updateFood} editable={editable} />
        ))}

        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{totalCalories} kcal</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setEditable(!editable)}
          >
            <Text style={styles.editBtnText}>{editable ? "Done" : "Edit"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveMeal}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Meal"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleSaveForLater} style={styles.saveForLaterBtn}>
          <Text style={styles.saveForLaterText}>Save for Later</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={resetState} style={styles.switchLink}>
          <Text style={styles.switchText}>Take another photo</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, styles.cameraMode]}>
      {analyzing ? (
        <View style={styles.analyzingBox}>
          <ActivityIndicator color="#4ecdc4" size="large" />
          <Text style={styles.analyzingText}>Analyzing your meal...</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
            <Text style={styles.captureBtnText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode("manual")} style={styles.switchLink}>
            <Text style={styles.switchText}>Type instead</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openSavedMeals} style={styles.switchLink}>
            <Text style={styles.switchText}>Saved Meals</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a" },
  content: { padding: 16, paddingBottom: 40 },
  cameraMode: { justifyContent: "center", alignItems: "center" },
  centerBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 20 },
  label: { fontSize: 12, color: "#888", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#1e1e36",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    fontSize: 16,
  },
  macroRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  macroField: { flex: 1 },
  tip: {
    backgroundColor: "#1a3a3a",
    borderRadius: 10,
    padding: 12,
    marginTop: 20,
    alignItems: "center",
  },
  tipText: { color: "#4ecdc4", fontSize: 12 },
  actions: { flexDirection: "row", gap: 12, marginTop: 20 },
  estimateBtn: {
    flex: 1,
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "#4ecdc4",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  estimateBtnText: { color: "#4ecdc4", fontSize: 14 },
  saveBtn: {
    flex: 1,
    backgroundColor: "#4ecdc4",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#000", fontSize: 14, fontWeight: "bold" },
  editBtn: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  editBtnText: { color: "#fff", fontSize: 14 },
  switchLink: { marginTop: 20, alignItems: "center" },
  switchText: { color: "#4ecdc4", fontSize: 14 },
  preview: { width: "100%", height: 220, borderRadius: 10, marginBottom: 16 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  resultTitle: { fontSize: 16, fontWeight: "bold", color: "#fff" },
  warningBadge: { backgroundColor: "#553300", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  warningText: { color: "#f7dc6f", fontSize: 11 },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#2a2a4a",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  totalLabel: { color: "#fff", fontWeight: "bold" },
  totalValue: { color: "#4ecdc4", fontWeight: "bold" },
  captureBtn: {
    backgroundColor: "#4ecdc4",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  captureBtnText: { color: "#000", fontSize: 18, fontWeight: "bold" },
  analyzingBox: { alignItems: "center", gap: 16 },
  analyzingText: { color: "#888", fontSize: 16 },
  saveForLaterBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#4ecdc4",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  saveForLaterText: { color: "#4ecdc4", fontSize: 14 },
  savedCard: {
    backgroundColor: "#1e1e36",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  savedInfo: { flex: 1 },
  savedName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  savedDetail: { color: "#4ecdc4", fontSize: 13, marginTop: 2 },
  savedFoods: { color: "#888", fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteText: { color: "#666", fontSize: 20 },
  emptyText: { color: "#666", fontSize: 14, textAlign: "center" },
});
