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
  FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Slider from "@react-native-community/slider";
import { scaleFoods } from "../../services/portion";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Segmented from "../../components/ui/Segmented";
import { useToast } from "../../components/ui/Toast";
import FoodItemRow from "../../components/FoodItemRow";
import {
  FoodItem,
  SavedMeal,
  analyzePhoto,
  analyzeText,
  createMeal,
  saveMealForLater,
  getSavedMeals,
  deleteSavedMeal,
} from "../../services/api";
import { colors, radii, spacing, type } from "../../theme";

const SEGMENTS = ["Photo", "Describe", "Saved"];

export default function SnapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [segment, setSegment] = useState(0);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [serverImagePath, setServerImagePath] = useState<string | null>(null);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [hasResults, setHasResults] = useState(false);
  const [confidence, setConfidence] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [hint, setHint] = useState("");
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState(false);
  const [portionPct, setPortionPct] = useState(100);

  const [foodName, setFoodName] = useState("");
  const [manCalories, setManCalories] = useState("");
  const [manProtein, setManProtein] = useState("");
  const [manCarbs, setManCarbs] = useState("");
  const [manFat, setManFat] = useState("");
  const [estimating, setEstimating] = useState(false);

  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);

  function resetState() {
    setImageUri(null);
    setServerImagePath(null);
    setFoods([]);
    setHasResults(false);
    setConfidence("");
    setHint("");
    setEditable(false);
    setPortionPct(100);
    setFoodName("");
    setManCalories("");
    setManProtein("");
    setManCarbs("");
    setManFat("");
    setSearchQuery("");
    setSavedMeals([]);
    setSegment(0);
  }

  function onChangeSegment(i: number) {
    setSegment(i);
    if (i === 2) loadSaved();
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setAnalyzing(true);
      try {
        const analysis = await analyzePhoto(uri);
        setFoods(analysis.foods);
        setConfidence(analysis.confidence);
        setServerImagePath(analysis.image_path ?? null);
        setHasResults(true);
      } catch (e: any) {
        Alert.alert("Analysis failed", e.message + "\n\nYou can try again or use Describe.");
      } finally {
        setAnalyzing(false);
      }
    }
  }

  async function handleReanalyze() {
    if (!imageUri) return;
    setAnalyzing(true);
    try {
      const analysis = await analyzePhoto(imageUri, hint.trim() || undefined);
      setFoods(analysis.foods);
      setConfidence(analysis.confidence);
      setServerImagePath(analysis.image_path ?? null);
    } catch (e: any) {
      Alert.alert("Re-analysis failed", e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveMeal() {
    setSaving(true);
    try {
      await createMeal({
        source: "photo",
        foods: scaleFoods(foods, portionPct / 100),
        image_path: serverImagePath ?? undefined,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast("Meal logged ✓");
      resetState();
      router.navigate("/");
    } catch (e: any) {
      Alert.alert("Error", "Could not save meal: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function doSaveForLater(name: string, items: FoodItem[]) {
    try {
      await saveMealForLater(name, items);
      showToast("Saved for later ✓");
    } catch (e: any) {
      Alert.alert("Error", "Could not save: " + e.message);
    }
  }

  function handleSaveForLater() {
    const mealName = foods.map((f) => f.name).join(", ");
    Alert.prompt
      ? Alert.prompt(
          "Save for Later",
          "Give this meal a name:",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Save", onPress: (name?: string) => doSaveForLater(name || mealName, foods) },
          ],
          "plain-text",
          mealName
        )
      : doSaveForLater(mealName, foods);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast("Meal logged ✓");
      resetState();
      router.navigate("/");
    } catch (e: any) {
      Alert.alert("Error", "Could not save meal: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadSaved() {
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
    } catch {
      // silently fail search
    }
  }

  async function logSavedMeal(meal: SavedMeal) {
    setSaving(true);
    try {
      await createMeal({ source: "manual", foods: meal.foods });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast(`"${meal.name}" logged ✓`);
      resetState();
      router.navigate("/");
    } catch (e: any) {
      Alert.alert("Error", "Could not log meal: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteSaved(meal: SavedMeal) {
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

  function updateFood(index: number, updated: FoodItem) {
    setFoods((prev) => prev.map((f, i) => (i === index ? updated : f)));
  }

  const header = (
    <View style={{ paddingTop: insets.top + spacing.s, paddingHorizontal: spacing.l }}>
      <Text style={type.largeTitle}>Snap</Text>
      <View style={{ marginTop: spacing.m }}>
        <Segmented options={SEGMENTS} selectedIndex={segment} onChange={onChangeSegment} />
      </View>
    </View>
  );

  // --- Saved tab ---
  if (segment === 2) {
    return (
      <View style={styles.container}>
        {header}
        <View style={{ paddingHorizontal: spacing.l, marginTop: spacing.m }}>
          <Input value={searchQuery} onChangeText={searchSaved} placeholder="Search saved meals..." />
        </View>
        {loadingSaved ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : savedMeals.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={type.footnote}>{searchQuery ? "No meals match your search." : "No saved meals yet."}</Text>
          </View>
        ) : (
          <FlatList
            data={savedMeals}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: spacing.l, paddingBottom: 32 }}
            renderItem={({ item }) => (
              <Card style={styles.savedCard}>
                <TouchableOpacity style={styles.savedInfo} onPress={() => logSavedMeal(item)} activeOpacity={0.6}>
                  <Text style={type.headline}>{item.name}</Text>
                  <Text style={styles.savedDetail}>
                    {item.foods.length} item{item.foods.length !== 1 ? "s" : ""} · {item.total_calories} kcal
                  </Text>
                  <Text style={type.footnote} numberOfLines={1}>
                    {item.foods.map((f) => f.name).join(", ")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSaved(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </Card>
            )}
          />
        )}
      </View>
    );
  }

  // --- Describe tab ---
  if (segment === 1) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {header}
        <View style={{ paddingHorizontal: spacing.l, marginTop: spacing.m }}>
          <Input label="Food name" value={foodName} onChangeText={setFoodName} placeholder="e.g. Apple, Greek Yogurt..." />
          <Input label="Calories" value={manCalories} onChangeText={setManCalories} keyboardType="numeric" placeholder="kcal" />
          <View style={styles.macroFieldsRow}>
            <View style={{ flex: 1 }}>
              <Input label="Protein" value={manProtein} onChangeText={setManProtein} keyboardType="numeric" placeholder="g" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Carbs" value={manCarbs} onChangeText={setManCarbs} keyboardType="numeric" placeholder="g" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Fat" value={manFat} onChangeText={setManFat} keyboardType="numeric" placeholder="g" />
            </View>
          </View>
          <Card style={styles.tipCard}>
            <Text style={styles.tipText}>💡 Type the food name, tap Estimate — AI fills in the numbers</Text>
          </Card>
          <View style={styles.actionsRow}>
            <Button title="Estimate" variant="tinted" onPress={handleEstimate} loading={estimating} style={{ flex: 1 }} />
            <Button title="Log meal" onPress={handleSaveManual} loading={saving} style={{ flex: 1 }} />
          </View>
          <Button
            title="Save for later"
            variant="plain"
            onPress={() => {
              if (!foodName.trim()) {
                Alert.alert("Missing", "Enter a food name first.");
                return;
              }
              doSaveForLater(foodName, [
                {
                  name: foodName,
                  quantity: "1 serving",
                  calories: parseInt(manCalories) || 0,
                  protein_g: parseFloat(manProtein) || 0,
                  carbs_g: parseFloat(manCarbs) || 0,
                  fat_g: parseFloat(manFat) || 0,
                },
              ]);
            }}
            style={{ marginTop: spacing.s }}
          />
        </View>
      </ScrollView>
    );
  }

  // --- Photo tab: results state ---
  if (hasResults) {
    const scaledFoods = scaleFoods(foods, portionPct / 100);
    const scaledTotal = scaledFoods.reduce((sum, f) => sum + f.calories, 0);
    // Editing corrects the whole-dish base values; the portion slider then scales them.
    // Keep the two modes separate so an inline edit never writes a scaled value back into `foods`.
    const displayFoods = editable ? foods : scaledFoods;
    const displayTotal = editable ? foods.reduce((sum, f) => sum + f.calories, 0) : scaledTotal;
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {header}
        <View style={{ paddingHorizontal: spacing.l, marginTop: spacing.m }}>
          <Card>
            {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}
            {confidence === "low" && (
              <View style={styles.warningBadge}>
                <Text style={styles.warningText}>Low confidence — please review</Text>
              </View>
            )}
            {displayFoods.map((food, i) => (
              <FoodItemRow key={i} item={food} index={i} onUpdate={updateFood} editable={editable} />
            ))}
            {!editable && (
              <>
                <View style={styles.portionRow}>
                  <Text style={type.label}>PORTION YOU ATE</Text>
                  <Text style={styles.portionPct}>{portionPct}%</Text>
                </View>
                <Slider
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  value={portionPct}
                  onValueChange={setPortionPct}
                  minimumTrackTintColor={colors.accent}
                  maximumTrackTintColor={colors.separator}
                  thumbTintColor={colors.accent}
                />
                <Text style={styles.portionCaption}>
                  {portionPct === 100 ? "Whole meal" : `You ate ${portionPct}%`} · {scaledTotal} kcal
                </Text>
              </>
            )}
            <View style={styles.totalBar}>
              <Text style={type.headline}>Total</Text>
              <Text style={[type.headline, { color: colors.accent }]}>{displayTotal} kcal</Text>
            </View>
          </Card>

          <View style={{ marginTop: spacing.l }}>
            <Input
              label="Not quite right? Give a hint"
              value={hint}
              onChangeText={setHint}
              placeholder="e.g. mapo tofu with rice, homemade less oil..."
            />
            <Button title="Re-analyze with hint" variant="tinted" onPress={handleReanalyze} loading={analyzing} />
          </View>

          <View style={styles.actionsRow}>
            <Button title={editable ? "Done editing" : "Edit"} variant="tinted" onPress={() => setEditable(!editable)} style={{ flex: 1 }} />
            <Button title={`Log meal · ${scaledTotal} kcal`} onPress={handleSaveMeal} loading={saving} style={{ flex: 1.4 }} />
          </View>
          <Button title="Save for later" variant="plain" onPress={handleSaveForLater} style={{ marginTop: spacing.s }} />
          <Button title="Take another photo" variant="plain" onPress={resetState} />
        </View>
      </ScrollView>
    );
  }

  // --- Photo tab: capture state ---
  return (
    <View style={styles.container}>
      {header}
      {analyzing ? (
        <View style={styles.centerBox}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.analyzingPreview} />}
          <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: spacing.l }} />
          <Text style={[type.footnote, { marginTop: spacing.s }]}>Analyzing your meal...</Text>
        </View>
      ) : (
        <View style={styles.centerBox}>
          <TouchableOpacity style={styles.captureBtn} onPress={takePhoto} activeOpacity={0.8}>
            <Ionicons name="camera" size={44} color={colors.textOnAccent} />
          </TouchableOpacity>
          <Text style={[type.headline, { marginTop: spacing.l }]}>Snap your meal</Text>
          <Text style={[type.footnote, { marginTop: 4 }]}>AI identifies foods & estimates calories</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.l },
  captureBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  preview: { width: "100%", height: 200, borderRadius: radii.m, marginBottom: spacing.m },
  analyzingPreview: { width: 220, height: 160, borderRadius: radii.m },
  warningBadge: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    marginBottom: spacing.s,
  },
  warningText: { color: colors.overGoal, fontSize: 12, fontWeight: "600" },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.m,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    marginTop: spacing.s,
  },
  portionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.m },
  portionPct: { fontSize: 15, fontWeight: "700", color: colors.accent },
  portionCaption: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
  actionsRow: { flexDirection: "row", gap: spacing.m, marginTop: spacing.l },
  macroFieldsRow: { flexDirection: "row", gap: spacing.s },
  tipCard: { backgroundColor: colors.accentSoft, marginTop: spacing.s, padding: spacing.m },
  tipText: { color: colors.tipText, fontSize: 13 },
  savedCard: { flexDirection: "row", alignItems: "center", marginBottom: spacing.s, padding: spacing.m },
  savedInfo: { flex: 1 },
  savedDetail: { color: colors.accent, fontSize: 13, marginTop: 2, fontWeight: "600" },
});
