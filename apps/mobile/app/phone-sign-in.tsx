import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Country } from "@thrifty/shared";
import { useSession } from "../src/ctx/auth";
import { ApiError } from "../src/api/client";
import { track } from "../src/lib/analytics";
import { colors, radii, spacing } from "../src/theme/colors";

const COUNTRIES: { label: string; value: Country }[] = [
  { label: "India", value: "IN" },
  { label: "United States", value: "US" },
];

export default function PhoneSignInScreen() {
  const router = useRouter();
  const { sendOtp, verifyOtp } = useSession();
  const [country, setCountry] = useState<Country>("IN");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendOtp() {
    setIsSubmitting(true);
    try {
      await sendOtp(phoneNumber.trim());
      setStep("code");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't send a code. Try again.";
      Alert.alert("Couldn't send code", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    setIsSubmitting(true);
    try {
      await verifyOtp(phoneNumber.trim(), code.trim(), country);
      track("signup_completed", { method: "phone", country });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Incorrect code. Try again.";
      Alert.alert("Verification failed", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in with phone</Text>

      {step === "phone" ? (
        <>
          <View style={styles.countryRow}>
            {COUNTRIES.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => setCountry(c.value)}
                style={[styles.countryChip, country === c.value && styles.countryChipSelected]}
              >
                <Text style={[styles.countryChipText, country === c.value && styles.countryChipTextSelected]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="+919876543210"
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
          <Text style={styles.hint}>Use full international format, e.g. +91 for India, +1 for the US.</Text>

          <Pressable style={styles.button} onPress={handleSendOtp} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.buttonText}>Send code</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.hint}>Enter the 6-digit code sent to {phoneNumber}.</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />

          <Pressable style={styles.button} onPress={handleVerifyOtp} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.buttonText}>Verify</Text>}
          </Pressable>

          <Pressable onPress={() => setStep("phone")}>
            <Text style={styles.link}>Use a different number</Text>
          </Pressable>
        </>
      )}

      <Pressable onPress={() => router.back()}>
        <Text style={styles.link}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.xxl, gap: spacing.md, backgroundColor: colors.background },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center", marginBottom: spacing.sm, color: colors.textPrimary },
  countryRow: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginBottom: spacing.xs },
  countryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  countryChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  countryChipText: { color: colors.textPrimary, fontWeight: "500" },
  countryChipTextSelected: { color: colors.textInverse },
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
  hint: { fontSize: 13, color: colors.textMuted },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { color: colors.textInverse, fontSize: 16, fontWeight: "600" },
  link: { textAlign: "center", marginTop: spacing.sm, color: colors.accent, fontWeight: "500" },
});
