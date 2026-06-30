// mobile/app/(auth)/verify-email.tsx
import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { verifyEmail, resendVerification } from "../../services/api";
import { setToken, notifyAuthChange } from "../../services/auth";
import { PENDING_ONBOARDING_KEY } from "../_layout";
import { colors, spacing, type } from "../../theme";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleVerify() {
    if (code.length !== 6) {
      Alert.alert("Error", "Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      const result = await verifyEmail(String(email), code);
      await setToken(result.token);
      await AsyncStorage.setItem(PENDING_ONBOARDING_KEY, "1");
      notifyAuthChange(true);
    } catch (e: any) {
      const msg = e.message.includes("409")
        ? "This email is already verified. Please log in."
        : "Invalid or expired code. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    try {
      await resendVerification(String(email));
      setCooldown(60);
      Alert.alert("Sent", "A new code is on its way if your account needs verification.");
    } catch {
      Alert.alert("Error", "Could not resend the code. Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <Text style={styles.logo}>📧</Text>
        <Text style={[type.largeTitle, styles.title]}>Verify your email</Text>
        <Text style={[type.footnote, styles.subtitle]}>Enter the 6-digit code we sent to {email}</Text>

        <Input placeholder="123456" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoCapitalize="none" autoCorrect={false} />

        <Button title="Verify" onPress={handleVerify} loading={loading} style={{ marginTop: spacing.s }} />

        <TouchableOpacity onPress={handleResend} disabled={cooldown > 0} style={{ marginTop: spacing.xl }}>
          <Text style={styles.link}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : <Text style={styles.linkBold}>Resend code</Text>}
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
  subtitle: { textAlign: "center", marginTop: 4, marginBottom: spacing.xxl },
  link: { color: colors.textSecondary, textAlign: "center", fontSize: 14 },
  linkBold: { color: colors.accent, fontWeight: "700" },
});
