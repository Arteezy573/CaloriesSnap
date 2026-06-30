import { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { register } from "../../services/api";
import { colors, spacing, type } from "../../theme";

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email.trim() || !password || !confirmPassword || !inviteCode.trim()) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, inviteCode.trim());
      router.push({ pathname: "/(auth)/verify-email", params: { email: email.trim() } });
    } catch (e: any) {
      const msg = e.message.includes("409")
        ? "An account with this email already exists."
        : e.message.includes("403")
        ? "Invalid invite code."
        : "Registration failed. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <Text style={styles.logo}>🥗</Text>
        <Text style={[type.largeTitle, styles.title]}>CaloriesSnap</Text>
        <Text style={[type.footnote, styles.subtitle]}>Create your account</Text>

        <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Input placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <Input placeholder="Invite Code" value={inviteCode} onChangeText={setInviteCode} autoCapitalize="none" autoCorrect={false} />

        <Button title="Create Account" onPress={handleRegister} loading={loading} style={{ marginTop: spacing.s }} />

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.xl }}>
          <Text style={styles.link}>
            Already have an account? <Text style={styles.linkBold}>Log in</Text>
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
