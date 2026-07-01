import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FoodItem } from "../services/api";
import { colors } from "../theme";

interface Props {
  item: FoodItem;
  index: number;
  onUpdate: (index: number, updated: FoodItem) => void;
  editable: boolean;
  onRemove?: (index: number) => void;
}

export default function FoodItemRow({ item, index, onUpdate, editable, onRemove }: Props) {
  function update(field: keyof FoodItem, value: string) {
    const numFields = ["calories", "protein_g", "carbs_g", "fat_g"];
    const parsed = numFields.includes(field) ? parseFloat(value) || 0 : value;
    onUpdate(index, { ...item, [field]: parsed });
  }

  if (!editable) {
    return (
      <View style={styles.row}>
        <View style={styles.topRow}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.calories}>{item.calories} kcal</Text>
        </View>
        <Text style={styles.detail}>
          {item.quantity}  •  P: {item.protein_g}g  C: {item.carbs_g}g  F: {item.fat_g}g
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.topRow}>
        <TextInput
          style={styles.nameInput}
          value={item.name}
          onChangeText={(v) => update("name", v)}
        />
        <TextInput
          style={styles.numInput}
          value={String(item.calories)}
          onChangeText={(v) => update("calories", v)}
          keyboardType="numeric"
        />
        <Text style={styles.unit}>kcal</Text>
        {onRemove && (
          <TouchableOpacity onPress={() => onRemove(index)} hitSlop={8} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.editDetailRow}>
        <TextInput
          style={[styles.nameInput, styles.qtyInput]}
          value={item.quantity}
          onChangeText={(v) => update("quantity", v)}
        />
        <Text style={styles.unit}>P</Text>
        <TextInput
          style={styles.numInput}
          value={String(item.protein_g)}
          onChangeText={(v) => update("protein_g", v)}
          keyboardType="numeric"
        />
        <Text style={styles.unit}>C</Text>
        <TextInput
          style={styles.numInput}
          value={String(item.carbs_g)}
          onChangeText={(v) => update("carbs_g", v)}
          keyboardType="numeric"
        />
        <Text style={styles.unit}>F</Text>
        <TextInput
          style={styles.numInput}
          value={String(item.fat_g)}
          onChangeText={(v) => update("fat_g", v)}
          keyboardType="numeric"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.fill,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: colors.text, fontSize: 14, flex: 1, fontWeight: "500" },
  nameInput: { color: colors.text, fontSize: 14, flex: 1, borderBottomWidth: 1, borderBottomColor: colors.accent, paddingBottom: 2 },
  calories: { color: colors.text, fontSize: 14, marginLeft: 8, fontWeight: "600" },
  detail: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  editDetailRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 4 },
  qtyInput: { fontSize: 12, color: colors.textSecondary },
  numInput: {
    color: colors.text,
    fontSize: 13,
    minWidth: 44,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingBottom: 2,
    marginLeft: 6,
  },
  unit: { color: colors.textSecondary, fontSize: 12, marginLeft: 6 },
  removeButton: { marginLeft: 10, padding: 2 },
});
