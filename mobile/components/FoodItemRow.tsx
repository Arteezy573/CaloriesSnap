import { View, Text, TextInput, StyleSheet } from "react-native";
import { FoodItem } from "../services/api";

interface Props {
  item: FoodItem;
  index: number;
  onUpdate: (index: number, updated: FoodItem) => void;
  editable: boolean;
}

export default function FoodItemRow({ item, index, onUpdate, editable }: Props) {
  function update(field: keyof FoodItem, value: string) {
    const numFields = ["calories", "protein_g", "carbs_g", "fat_g"];
    const parsed = numFields.includes(field) ? parseFloat(value) || 0 : value;
    onUpdate(index, { ...item, [field]: parsed });
  }

  return (
    <View style={styles.row}>
      <View style={styles.topRow}>
        {editable ? (
          <TextInput
            style={styles.nameInput}
            value={item.name}
            onChangeText={(v) => update("name", v)}
          />
        ) : (
          <Text style={styles.name}>{item.name}</Text>
        )}
        <Text style={styles.calories}>{item.calories} kcal</Text>
      </View>
      <Text style={styles.detail}>
        {item.quantity}  •  P: {item.protein_g}g  C: {item.carbs_g}g  F: {item.fat_g}g
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: "#1e1e36", borderRadius: 10, padding: 12, marginBottom: 8 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: "#fff", fontSize: 14, flex: 1 },
  nameInput: { color: "#fff", fontSize: 14, flex: 1, borderBottomWidth: 1, borderBottomColor: "#4ecdc4", paddingBottom: 2 },
  calories: { color: "#fff", fontSize: 14, marginLeft: 8 },
  detail: { color: "#888", fontSize: 12, marginTop: 4 },
});
