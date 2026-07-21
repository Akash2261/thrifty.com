import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import type { NotificationPreferences } from "@thrifty/shared";
import { useSession } from "../../src/ctx/auth";
import { useUpgrade } from "../../src/hooks/useUpgrade";
import { updateNotificationPreferences } from "../../src/api/notifications";
import { colors, radii, spacing } from "../../src/theme/colors";

const PREFERENCE_LABELS: Record<keyof NotificationPreferences, string> = {
  returnWindowReminders: "Return window reminders",
  warrantyReminders: "Warranty expiry reminders",
  subscriptionRenewalReminders: "Subscription renewal reminders",
  unusedSubscriptionDigest: "Unused subscription digest",
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, deleteAccount, refreshUser } = useSession();
  const { isUpgrading, startUpgrade } = useUpgrade();
  const [copied, setCopied] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleDeleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account and everything in it — warranty items, subscriptions, connections, and claims. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteAccount();
            } catch {
              Alert.alert("Couldn't delete account", "Try again in a moment.");
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }

  async function handleCopyForwardingEmail() {
    if (!user) return;
    await Clipboard.setStringAsync(user.inboundEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleTogglePreference(key: keyof NotificationPreferences, value: boolean) {
    setSavingKey(key);
    try {
      await updateNotificationPreferences({ [key]: value });
      await refreshUser();
    } catch {
      // leave the switch in its previous state; refreshUser above only applies on success
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>{user?.email ? "Email" : "Phone"}</Text>
        <Text style={styles.value}>{user?.email ?? user?.phoneNumber}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Country</Text>
        <Text style={styles.value}>{user?.country}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Plan</Text>
        <Text style={styles.value}>{user?.tier === "premium" ? "Premium" : "Free (5 items)"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Forward receipts to</Text>
        <Text style={styles.forwardingBody}>
          Forward any order-confirmation email to this address and Thrifty will scan it
          automatically — no photo needed.
        </Text>
        <Pressable style={styles.forwardingRow} onPress={handleCopyForwardingEmail}>
          <Text style={styles.forwardingEmail} numberOfLines={1}>
            {user?.inboundEmail}
          </Text>
          <Text style={styles.copyLabel}>{copied ? "Copied!" : "Copy"}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Connected email</Text>
        <Text style={styles.forwardingBody}>
          Connect Gmail or Outlook and Thrifty scans it automatically for order confirmations.
        </Text>
        <Pressable style={styles.forwardingRow} onPress={() => router.push("/email-connections")}>
          <Text style={styles.connectEmailText}>Manage email connections</Text>
          <Text style={styles.copyLabel}>→</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>WhatsApp</Text>
        <Text style={styles.forwardingBody}>
          Send a receipt photo or forward an order confirmation on WhatsApp and Thrifty tracks it.
        </Text>
        <Pressable style={styles.forwardingRow} onPress={() => router.push("/whatsapp-link")}>
          <Text style={styles.connectEmailText}>Link WhatsApp</Text>
          <Text style={styles.copyLabel}>→</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Claims</Text>
        <Pressable style={styles.forwardingRow} onPress={() => router.push("/claims")}>
          <Text style={styles.connectEmailText}>View your claims</Text>
          <Text style={styles.copyLabel}>→</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Household</Text>
        <Pressable style={styles.forwardingRow} onPress={() => router.push("/household")}>
          <Text style={styles.connectEmailText}>Manage household</Text>
          <Text style={styles.copyLabel}>→</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Privacy</Text>
        <Pressable style={styles.forwardingRow} onPress={() => router.push("/data-usage")}>
          <Text style={styles.connectEmailText}>What we read from your data</Text>
          <Text style={styles.copyLabel}>→</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Notifications</Text>
        {user &&
          (Object.keys(PREFERENCE_LABELS) as (keyof NotificationPreferences)[]).map((key) => (
            <View key={key} style={styles.prefRow}>
              <Text style={styles.prefLabel}>{PREFERENCE_LABELS[key]}</Text>
              {savingKey === key ? (
                <ActivityIndicator size="small" />
              ) : (
                <Switch
                  value={user.notificationPreferences[key]}
                  onValueChange={(value) => handleTogglePreference(key, value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              )}
            </View>
          ))}
      </View>

      {user?.tier !== "premium" && (
        <View style={styles.section}>
          <Text style={styles.label}>Two ways to pay</Text>
          <Text style={styles.forwardingBody}>
            Upgrade to Premium for unlimited items, or stay free and pay only a share of what you
            save — when you cancel a subscription from SubStop, confirm it worked and we'll charge
            a percentage of that savings, nothing upfront.
          </Text>
          <Pressable style={styles.upgradeButton} onPress={startUpgrade} disabled={isUpgrading}>
            {isUpgrading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.upgradeButtonText}>Upgrade to Premium — unlimited items</Text>
            )}
          </Pressable>
        </View>
      )}

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={handleDeleteAccount} disabled={isDeleting}>
        {isDeleting ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.deleteText}>Delete account</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.xl, backgroundColor: colors.background },
  section: { gap: spacing.xs },
  label: { fontSize: 12, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  value: { fontSize: 16, color: colors.textPrimary },
  forwardingBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginTop: 2, marginBottom: spacing.xs },
  forwardingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  forwardingEmail: { fontSize: 15, flex: 1, color: colors.textPrimary },
  connectEmailText: { fontSize: 15, flex: 1, fontWeight: "600", color: colors.textPrimary },
  copyLabel: { fontSize: 14, fontWeight: "600", color: colors.accent },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  prefLabel: { fontSize: 15, flex: 1, marginRight: spacing.sm, color: colors.textPrimary },
  upgradeButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  upgradeButtonText: { color: colors.textInverse, fontSize: 15, fontWeight: "600" },
  signOutButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    backgroundColor: colors.dangerBg,
  },
  signOutText: { color: colors.danger, fontSize: 16, fontWeight: "600" },
  deleteButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: "600" },
});
