import { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { login } from "../../services/api";
import { setToken, notifyAuthChange } from "../../services/auth";
import { colors, spacing, type } from "../../theme";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter email and password.");
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      await setToken(result.token);
      notifyAuthChange(true);
    } catch (e: any) {
      if (e.message.includes("email_not_verified")) {
        router.push({ pathname: "/(auth)/verify-email", params: { email: email.trim() } });
        return;
      }
      const msg = e.message.includes("401") ? "Invalid email or password." : "Login failed. Please try again.";
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
        <Text style={[type.footnote, styles.subtitle]}>Log in to your account</Text>

        <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

        <Button title="Log In" onPress={handleLogin} loading={loading} style={{ marginTop: spacing.s }} />

        <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={{ marginTop: spacing.xl }}>
          <Text style={styles.link}>
            Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
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
