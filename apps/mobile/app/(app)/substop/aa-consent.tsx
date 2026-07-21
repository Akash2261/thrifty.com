import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../../../src/api/client";
import { createLinkSession, pollLinkStatus, syncBankAccounts } from "../../../src/api/substop";
import { colors, radii, spacing } from "../../../src/theme/colors";

const CONSENT_DETAILS = [
  { label: "What's shared", value: "Bank transaction history (read-only)" },
  { label: "Purpose", value: "Detecting recurring subscriptions" },
  { label: "Duration", value: "12 months, renewable" },
  { label: "Frequency", value: "Refreshed monthly" },
];

export default function AaConsentScreen() {
  const router = useRouter();
  const [isLinking, setIsLinking] = useState(false);

  async function handleContinue() {
    setIsLinking(true);
    try {
      const { linkToken, hostedLinkUrl } = await createLinkSession();
      await WebBrowser.openBrowserAsync(hostedLinkUrl);

      // The consent-approval flow finishes inside your Account Aggregator's own app/web UI —
      // poll a few times after the browser closes to give its notification a moment to land.
      let linked = false;
      for (let attempt = 0; attempt < 6 && !linked; attempt++) {
        const status = await pollLinkStatus(linkToken);
        if (status.linked) {
          linked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (!linked) {
        Alert.alert(
          "Still processing",
          "We haven't confirmed your consent yet — this can take a few minutes. Pull to refresh on the SubStop tab shortly.",
        );
        router.back();
        return;
      }

      await syncBankAccounts().catch(() => {});
      router.back();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't start the consent flow. Try again.";
      Alert.alert("Couldn't connect", message);
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Link your bank via Account Aggregator</Text>
      <Text style={styles.intro}>
        India's RBI-regulated Account Aggregator framework lets you share bank data with Thrifty
        without ever handing over your banking password. You'll pick your bank and approve exactly
        what to share in your Account Aggregator's own app.
      </Text>

      <View style={styles.detailsCard}>
        {CONSENT_DETAILS.map((detail) => (
          <View key={detail.label} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{detail.label}</Text>
            <Text style={styles.detailValue}>{detail.value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        You can revoke this consent at any time from your Account Aggregator's app — Thrifty
        immediately loses access once you do.
      </Text>

      <Pressable style={styles.continueButton} onPress={handleContinue} disabled={isLinking}>
        {isLinking ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.continueButtonText}>Continue to consent</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  intro: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  detailsCard: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.lg, gap: spacing.sm + 2 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailValue: { fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right", color: colors.textPrimary },
  note: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  continueButton: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md + 2, alignItems: "center", marginTop: spacing.sm },
  continueButtonText: { color: colors.textInverse, fontSize: 16, fontWeight: "600" },
});
