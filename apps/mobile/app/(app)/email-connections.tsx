import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { EmailConnection, EmailProvider } from "@thrifty/shared";
import { ApiError } from "../../src/api/client";
import {
  authorizeEmailConnection,
  disconnectEmailConnection,
  listEmailConnections,
  listReviewQueue,
  syncEmailConnection,
} from "../../src/api/emailConnections";
import { track } from "../../src/lib/analytics";
import { colors, radii, spacing } from "../../src/theme/colors";

const PROVIDERS: { value: EmailProvider; label: string }[] = [
  { value: "gmail", label: "Gmail" },
  { value: "outlook", label: "Outlook / Hotmail" },
  { value: "yahoo", label: "Yahoo Mail" },
];

const SCAN_DEPTH_OPTIONS = [30, 90, 180];

const SYNC_STATUS_LABEL: Record<EmailConnection["syncStatus"], string> = {
  pending: "Not synced yet",
  active: "Connected",
  error: "Needs attention",
  disconnected: "Disconnected",
};

export default function EmailConnectionsScreen() {
  const router = useRouter();
  const [connections, setConnections] = useState<EmailConnection[] | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [scanDepthDays, setScanDepthDays] = useState(30);
  const [connectingProvider, setConnectingProvider] = useState<EmailProvider | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ connections: fetched }, { items }] = await Promise.all([listEmailConnections(), listReviewQueue()]);
      setConnections(fetched);
      setReviewCount(items.length);
    } catch {
      // leave whatever was already on screen
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleConnect(provider: EmailProvider) {
    setConnectingProvider(provider);
    try {
      const { authUrl } = await authorizeEmailConnection({ provider, historicalScanDepthDays: scanDepthDays });
      const result = await WebBrowser.openAuthSessionAsync(authUrl, "thrifty://email-callback");

      if (result.type === "success" && result.url.includes("status=success")) {
        track("email_connected", { provider });
        await load();
      } else if (result.type === "success") {
        const message = decodeURIComponent(result.url.split("message=")[1]?.split("&")[0] ?? "Connection failed");
        Alert.alert("Couldn't connect", message);
      }
      // result.type === "cancel"/"dismiss" — user backed out, nothing to show
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't start that connection. Try again.";
      Alert.alert("Connection failed", message);
    } finally {
      setConnectingProvider(null);
    }
  }

  async function handleSync(id: string) {
    setBusyId(id);
    try {
      await syncEmailConnection(id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't sync that connection. Try again.";
      Alert.alert("Sync failed", message);
    } finally {
      // Reload either way — a failed sync still updates the connection's syncStatus/syncError
      // server-side, and the card should reflect that rather than showing stale "Connected".
      await load();
      setBusyId(null);
    }
  }

  function handleDisconnect(connection: EmailConnection) {
    Alert.alert("Disconnect this account?", connection.emailAddress, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          setBusyId(connection.id);
          try {
            await disconnectEmailConnection(connection.id);
            await load();
          } catch (err) {
            Alert.alert("Couldn't disconnect", err instanceof ApiError ? err.message : "Try again.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        Connect an email account and Thrifty will scan it for order confirmations, extracting
        warranty items automatically — no photo needed.
      </Text>

      {reviewCount > 0 && (
        <Pressable style={styles.reviewBanner} onPress={() => router.push("/email-review")}>
          <Text style={styles.reviewBannerText}>
            {reviewCount} email{reviewCount === 1 ? "" : "s"} {reviewCount === 1 ? "needs" : "need"} review before saving
          </Text>
          <Text style={styles.reviewBannerArrow}>→</Text>
        </Pressable>
      )}

      {connections === null ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        connections.map((connection) => (
          <View key={connection.id} style={styles.connectionCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.connectionEmail}>{connection.emailAddress}</Text>
              <Text style={styles.connectionMeta}>
                {SYNC_STATUS_LABEL[connection.syncStatus]}
                {connection.lastSyncedAt ? ` · last synced ${new Date(connection.lastSyncedAt).toLocaleDateString()}` : ""}
              </Text>
              {connection.syncError && <Text style={styles.connectionError}>{connection.syncError}</Text>}
            </View>
            {busyId === connection.id ? (
              <ActivityIndicator />
            ) : (
              <View style={styles.connectionActions}>
                <Pressable onPress={() => handleSync(connection.id)}>
                  <Text style={styles.actionLink}>Sync</Text>
                </Pressable>
                <Pressable onPress={() => handleDisconnect(connection)}>
                  <Text style={[styles.actionLink, styles.destructiveLink]}>Disconnect</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scan how far back</Text>
        <View style={styles.chipRow}>
          {SCAN_DEPTH_OPTIONS.map((days) => (
            <Pressable
              key={days}
              onPress={() => setScanDepthDays(days)}
              style={[styles.chip, scanDepthDays === days && styles.chipSelected]}
            >
              <Text style={[styles.chipText, scanDepthDays === days && styles.chipTextSelected]}>{days} days</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connect an account</Text>
        {PROVIDERS.map((provider) => (
          <Pressable
            key={provider.value}
            style={styles.providerButton}
            onPress={() => handleConnect(provider.value)}
            disabled={connectingProvider !== null}
          >
            {connectingProvider === provider.value ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.providerButtonText}>{provider.label}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 48, backgroundColor: colors.background },
  intro: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  reviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  reviewBannerText: { fontSize: 14, fontWeight: "600", color: colors.textInverse, flex: 1 },
  reviewBannerArrow: { fontSize: 16, color: colors.textInverse },
  connectionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.md + 2,
    gap: spacing.sm,
  },
  connectionEmail: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  connectionMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  connectionError: { fontSize: 12, color: colors.danger, marginTop: spacing.xs },
  connectionActions: { flexDirection: "row", gap: spacing.lg },
  actionLink: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  destructiveLink: { color: colors.danger },
  section: { gap: spacing.sm + 2 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  chipRow: { flexDirection: "row", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: "500" },
  chipTextSelected: { color: colors.textInverse },
  providerButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
  },
  providerButtonText: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
});
