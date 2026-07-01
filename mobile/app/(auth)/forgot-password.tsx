// mobile/app/(auth)/forgot-password.tsx
import { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { forgotPassword } from "../../services/api";
import { colors, spacing, type } from "../../theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      router.push({ pathname: "/(auth)/reset-password", params: { email: email.trim() } });
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <Text style={styles.logo}>🔑</Text>
        <Text style={[type.largeTitle, styles.title]}>Forgot password</Text>
        <Text style={[type.footnote, styles.subtitle]}>Enter your email and we'll send a reset code.</Text>

        <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

        <Button title="Send reset code" onPress={handleSubmit} loading={loading} style={{ marginTop: spacing.s }} />

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.xl }}>
          <Text style={styles.link}>
            Remembered it? <Text style={styles.linkBold}>Back to log in</Text>
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
