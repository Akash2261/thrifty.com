import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CancellationOptions, CancellationRequest } from "@thrifty/shared";
import { ApiError } from "../../../src/api/client";
import {
  createCancellationRequest,
  getCancellationOptions,
  sendCancellationRequest,
} from "../../../src/api/cancellation";
import { confirmSubscriptionCancelled } from "../../../src/api/substop";
import { track } from "../../../src/lib/analytics";
import { colors, radii, spacing } from "../../../src/theme/colors";

export default function CancelSubscriptionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [options, setOptions] = useState<CancellationOptions | null>(null);
  const [draft, setDraft] = useState<CancellationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    getCancellationOptions(id)
      .then(setOptions)
      .catch((err) => Alert.alert("Couldn't load", err instanceof ApiError ? err.message : "Try again."))
      .finally(() => setIsLoading(false));
  }, [id]);

  async function handleOpenSelfService() {
    if (!options?.selfServiceUrl) return;
    await WebBrowser.openBrowserAsync(options.selfServiceUrl);
  }

  async function handleDraft() {
    setIsBusy(true);
    try {
      const { item } = await createCancellationRequest(id);
      setDraft(item);
    } catch (err) {
      Alert.alert("Couldn't draft request", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setIsBusy(false);
    }
  }

  function confirmSend() {
    if (!draft) return;
    Alert.alert(
      "Send this email?",
      `Thrifty will send this cancellation request to ${draft.recipientEmail} on your behalf.`,
      [
        { text: "Send", onPress: handleSend },
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  async function handleSend() {
    if (!draft) return;
    setIsBusy(true);
    try {
      const { item } = await sendCancellationRequest(draft.id);
      setDraft(item);
    } catch (err) {
      Alert.alert("Couldn't send", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirmCancelled() {
    setIsConfirming(true);
    try {
      const result = await confirmSubscriptionCancelled(id);
      track("subscription_cancellation_confirmed", { hadCharge: !!result.checkoutUrl });
      if (result.checkoutUrl) {
        await WebBrowser.openBrowserAsync(result.checkoutUrl);
        Alert.alert(
          "Thanks!",
          `That's ${result.charge?.currency} ${result.charge?.chargeAmount.toFixed(2)} for helping you save ${result.charge?.currency} ${result.charge?.estimatedAnnualSavings.toFixed(2)}/year.`,
        );
      } else {
        Alert.alert("Marked as cancelled", "No charge — you're already on Premium.");
      }
      router.back();
    } catch (err) {
      Alert.alert("Couldn't confirm", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setIsConfirming(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!options) {
    return (
      <View style={styles.centered}>
        <Text>Couldn't load cancellation options.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{options.displayName}</Text>
      <Text style={styles.instructions}>{options.instructions}</Text>

      {options.method === "self_service_url" && (
        <Pressable style={styles.button} onPress={handleOpenSelfService}>
          <Text style={styles.buttonText}>Open {options.displayName}'s account page</Text>
        </Pressable>
      )}

      {options.method === "email" && !draft && (
        <Pressable style={styles.button} onPress={handleDraft} disabled={isBusy}>
          {isBusy ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.buttonText}>Draft a cancellation email</Text>}
        </Pressable>
      )}

      {options.method === "email" && draft && draft.status !== "sent" && (
        <View style={styles.draftCard}>
          <Text style={styles.draftLabel}>To</Text>
          <Text style={styles.draftValue}>{draft.recipientEmail}</Text>
          <Text style={styles.draftLabel}>Subject</Text>
          <Text style={styles.draftValue}>{draft.draftSubject}</Text>
          <Text style={styles.draftLabel}>Message</Text>
          <Text style={styles.draftValue}>{draft.draftBody}</Text>

          <Pressable style={styles.button} onPress={confirmSend} disabled={isBusy}>
            {isBusy ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.buttonText}>Send this email</Text>}
          </Pressable>
        </View>
      )}

      {draft?.status === "sent" && <Text style={styles.sentNotice}>Sent — we'll update the status here.</Text>}

      <View style={styles.confirmSection}>
        <Text style={styles.confirmLabel}>Already cancelled this?</Text>
        <Text style={styles.confirmBody}>
          Let us know it worked — Premium members pay nothing extra; everyone else pays a share of
          what they save, only once it's confirmed.
        </Text>
        <Pressable style={styles.confirmButton} onPress={handleConfirmCancelled} disabled={isConfirming}>
          {isConfirming ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.confirmButtonText}>Confirm this saved me money</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  instructions: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  button: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md + 2, alignItems: "center", marginTop: spacing.sm },
  buttonText: { color: colors.textInverse, fontSize: 16, fontWeight: "600" },
  draftCard: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.lg, gap: 4, marginTop: spacing.md },
  draftLabel: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  draftValue: { fontSize: 14, color: colors.textPrimary },
  sentNotice: { fontSize: 14, color: colors.textPrimary, fontWeight: "700", marginTop: spacing.md },
  confirmSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  confirmLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  confirmBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  confirmButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  confirmButtonText: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
});
