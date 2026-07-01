// mobile/app/(auth)/reset-password.tsx
import { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { resetPassword } from "../../services/api";
import { colors, spacing, type } from "../../theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (code.length !== 6) {
      Alert.alert("Error", "Enter the 6-digit code from your email.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(String(email), code, password);
      Alert.alert("Success", "Your password has been updated. Please log in.", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch {
      Alert.alert("Error", "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <Text style={styles.logo}>🔒</Text>
        <Text style={[type.largeTitle, styles.title]}>Reset password</Text>
        <Text style={[type.footnote, styles.subtitle]}>Enter the code sent to {email} and a new password.</Text>

        <Input placeholder="123456" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoCapitalize="none" autoCorrect={false} />
        <Input placeholder="New password" value={password} onChangeText={setPassword} secureTextEntry />
        <Input placeholder="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

        <Button title="Update password" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.s }} />

        <TouchableOpacity onPress={() => router.replace("/(auth)/login")} style={{ marginTop: spacing.xl }}>
          <Text style={styles.link}>
            <Text style={styles.linkBold}>Back to log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: "center", padding: spacing.xl },
  logo: { fontSize: 56, textAlign: "center", marginBottom: spacing.s },
  title: { textAlign: "center" },
  subtitle: { textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.xxl },
  link: { color: colors.textSecondary, textAlign: "center", fontSize: 14 },
  linkBold: { color: colors.accent, fontWeight: "700" },
});
