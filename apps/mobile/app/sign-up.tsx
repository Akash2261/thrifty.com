import { Link } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSession } from "../src/ctx/auth";
import { ApiError } from "../src/api/client";
import { track } from "../src/lib/analytics";
import { colors, radii, spacing } from "../src/theme/colors";

export default function SignUpScreen() {
  const { signUp } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await signUp(name.trim(), email.trim(), phoneNumber.trim(), dateOfBirth.trim(), password);
      track("signup_completed", { method: "password" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to create your account";
      Alert.alert("Sign up failed", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your account</Text>

      <TextInput style={styles.input} placeholder="Name" autoCapitalize="words" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone (e.g. +919876543210)"
        autoCapitalize="none"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
      />
      <TextInput
        style={styles.input}
        placeholder="Date of birth (YYYY-MM-DD)"
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 8 characters)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.buttonText}>Sign up</Text>}
      </Pressable>

      <Link href="/sign-in" style={styles.link}>
        Already have an account? Sign in
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.xxl, gap: spacing.md, backgroundColor: colors.background },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center", marginBottom: spacing.md, color: colors.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { color: colors.textInverse, fontSize: 16, fontWeight: "600" },
  link: { textAlign: "center", marginTop: spacing.lg, color: colors.accent, fontWeight: "500" },
});
