import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { DetectedSubscription, LinkedBankAccount } from "@thrifty/shared";
import { ApiError } from "../../../src/api/client";
import {
  confirmSubscriptionInUse,
  createLinkSession,
  listLinkedAccounts,
  listSubscriptions,
  pollLinkStatus,
  syncBankAccounts,
} from "../../../src/api/substop";
import { track } from "../../../src/lib/analytics";
import { useSession } from "../../../src/ctx/auth";
import { cardShadow, colors, radii, spacing } from "../../../src/theme/colors";

const CADENCE_LABEL: Record<DetectedSubscription["cadence"], string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function sourceLabel(sub: DetectedSubscription): string {
  if (sub.detectedFromBank && sub.detectedFromEmail) return "via bank + email";
  if (sub.detectedFromEmail) return "via email";
  return "via bank";
}

export default function SubStopScreen() {
  const router = useRouter();
  const { user } = useSession();
  const [accounts, setAccounts] = useState<LinkedBankAccount[] | null>(null);
  const [subs, setSubs] = useState<DetectedSubscription[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [currency, setCurrency] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ accounts: fetchedAccounts }, subsResult] = await Promise.all([
        listLinkedAccounts(),
        listSubscriptions(),
      ]);
      setAccounts(fetchedAccounts);
      setSubs(subsResult.items);
      setMonthlyTotal(subsResult.monthlyTotal);
      setCurrency(subsResult.currency);
    } catch {
      // keep whatever was already on screen; the pull-to-refresh spinner communicates failure
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function handleLinkBankPress() {
    if (user?.country === "IN") {
      router.push("/substop/aa-consent");
      return;
    }
    handleLinkBank();
  }

  async function handleLinkBank() {
    setIsLinking(true);
    try {
      const { linkToken, hostedLinkUrl } = await createLinkSession();
      await WebBrowser.openBrowserAsync(hostedLinkUrl);

      // The hosted flow finishes inside the browser; poll a few times after it closes to give
      // Plaid's webhook/session data a moment to become available.
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
          "We haven't confirmed the link yet. Pull to refresh in a moment to check again.",
        );
        return;
      }

      await handleSync();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't link that account. Try again.";
      Alert.alert("Linking failed", message);
    } finally {
      setIsLinking(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const wasFirstSync = subs.length === 0;
      await syncBankAccounts();
      const { items: refreshed } = await listSubscriptions();
      if (wasFirstSync && refreshed.length > 0) {
        track("subscriptions_detected", { count: refreshed.length });
      }
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't refresh your transactions.";
      Alert.alert("Sync failed", message);
    } finally {
      setIsSyncing(false);
    }
  }

  function handleConfirm(sub: DetectedSubscription) {
    Alert.alert(sub.displayName, undefined, [
      { text: "Still using it", onPress: () => submitConfirm(sub.id, true) },
      { text: "Not using it", onPress: () => submitConfirm(sub.id, false), style: "destructive" },
      {
        text: "How do I cancel this?",
        onPress: () => router.push({ pathname: "/substop/cancel", params: { id: sub.id } }),
      },
      { text: "Dismiss", style: "cancel" },
    ]);
  }

  async function submitConfirm(id: string, inUse: boolean) {
    try {
      await confirmSubscriptionInUse(id, { inUse });
      await load();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Find your subscription leakage</Text>
        <Text style={styles.emptyBody}>
          Securely link a bank or card (read-only) and Thrifty will scan your last 3 months of
          transactions for recurring subscriptions.
        </Text>
        <Pressable style={styles.linkButton} onPress={handleLinkBankPress} disabled={isLinking}>
          {isLinking ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.linkButtonText}>Link a bank or card</Text>}
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={subs}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={isSyncing} onRefresh={handleSync} />}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Monthly subscription spend</Text>
          <Text style={styles.summaryAmount}>
            {currency ?? ""} {monthlyTotal.toFixed(2)}
          </Text>
          <Text style={styles.summarySub}>
            {subs.length} subscription{subs.length === 1 ? "" : "s"} found across your linked accounts
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyBody}>
            No recurring charges detected yet. Pull to refresh after your bank has more history.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => handleConfirm(item)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{item.displayName}</Text>
            <Text style={styles.rowSubtitle}>
              {CADENCE_LABEL[item.cadence]} · {sourceLabel(item)}
            </Text>
            {item.status === "flagged" && <Text style={styles.flagged}>Flagged as unused</Text>}
          </View>
          <Text style={styles.amount}>
            {item.currency} {item.avgAmount.toFixed(2)}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxxl, gap: spacing.md, backgroundColor: colors.background },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", color: colors.textPrimary },
  emptyBody: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  linkButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.sm,
  },
  linkButtonText: { color: colors.textInverse, fontSize: 16, fontWeight: "600" },
  listContent: { paddingBottom: spacing.xxxl, backgroundColor: colors.background },
  summaryCard: { backgroundColor: colors.primary, borderRadius: radii.lg, padding: spacing.xl, margin: spacing.lg, gap: 4, ...cardShadow },
  summaryLabel: { fontSize: 13, color: colors.textInverse, opacity: 0.65 },
  summaryAmount: { fontSize: 32, fontWeight: "700", color: colors.textInverse },
  summarySub: { fontSize: 13, color: colors.textInverse, opacity: 0.55, marginTop: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  rowTitle: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  rowSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  flagged: { fontSize: 12, color: colors.textPrimary, fontWeight: "700", marginTop: spacing.xs },
  amount: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
});
