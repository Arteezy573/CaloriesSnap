import { View, Text, StyleSheet } from "react-native";

export default function GoalsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Goals — coming next</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a", justifyContent: "center", alignItems: "center" },
  text: { color: "#fff", fontSize: 18 },
});
