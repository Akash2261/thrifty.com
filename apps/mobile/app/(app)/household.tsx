import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { HouseholdInfo, SharedItemsResponse } from "@thrifty/shared";
import { ApiError } from "../../src/api/client";
import { createHousehold, getHousehold, getSharedItems, joinHousehold, leaveHousehold } from "../../src/api/household";
import { colors, radii, spacing } from "../../src/theme/colors";

export default function HouseholdScreen() {
  const [household, setHousehold] = useState<HouseholdInfo | null | undefined>(undefined);
  const [shared, setShared] = useState<SharedItemsResponse | null>(null);
  const [householdName, setHouseholdName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { household: fetched } = await getHousehold();
      setHousehold(fetched);
      if (fetched) {
        const items = await getSharedItems();
        setShared(items);
      }
    } catch {
      setHousehold(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleCreate() {
    if (!householdName.trim()) return;
    setIsBusy(true);
    try {
      await createHousehold({ name: householdName.trim() });
      await load();
    } catch (err) {
      Alert.alert("Couldn't create household", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleJoin() {
    if (!inviteCodeInput.trim()) return;
    setIsBusy(true);
    try {
      await joinHousehold({ inviteCode: inviteCodeInput.trim().toUpperCase() });
      await load();
    } catch (err) {
      Alert.alert("Couldn't join household", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setIsBusy(false);
    }
  }

  function handleLeave() {
    Alert.alert("Leave this household?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          setIsBusy(true);
          try {
            await leaveHousehold();
            setShared(null);
            await load();
          } catch (err) {
            Alert.alert("Couldn't leave", err instanceof ApiError ? err.message : "Try again.");
          } finally {
            setIsBusy(false);
          }
        },
      },
    ]);
  }

  async function handleCopyInviteCode() {
    if (!household?.inviteCode) return;
    await Clipboard.setStringAsync(household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (household === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (household === null) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.intro}>
          Share warranty items and subscriptions with people in your household.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Create a household</Text>
          <TextInput
            style={styles.input}
            placeholder="Household name"
            value={householdName}
            onChangeText={setHouseholdName}
          />
          <Pressable style={styles.button} onPress={handleCreate} disabled={isBusy}>
            {isBusy ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.buttonText}>Create</Text>}
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Join with an invite code</Text>
          <TextInput
            style={styles.input}
            placeholder="Invite code"
            autoCapitalize="characters"
            value={inviteCodeInput}
            onChangeText={setInviteCodeInput}
          />
          <Pressable style={styles.secondaryButton} onPress={handleJoin} disabled={isBusy}>
            {isBusy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.secondaryButtonText}>Join</Text>}
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.householdName}>{household.name}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invite code</Text>
        <Pressable style={styles.inviteRow} onPress={handleCopyInviteCode}>
          <Text style={styles.inviteCode}>{household.inviteCode}</Text>
          <Text style={styles.copyLabel}>{copied ? "Copied!" : "Copy"}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Members</Text>
        {household.members.map((member) => (
          <Text key={member.userId} style={styles.memberRow}>
            {member.email ?? "Unknown"} · {member.role}
          </Text>
        ))}
      </View>

      {shared && shared.warrantyItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared warranty items</Text>
          {shared.warrantyItems.map((item) => (
            <Text key={item.id} style={styles.memberRow}>
              {item.itemName} — {item.ownerEmail}
            </Text>
          ))}
        </View>
      )}

      {shared && shared.subscriptions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shared subscriptions</Text>
          {shared.subscriptions.map((sub) => (
            <Text key={sub.id} style={styles.memberRow}>
              {sub.displayName} ({sub.currency} {sub.avgAmount.toFixed(2)}) — {sub.ownerEmail}
            </Text>
          ))}
        </View>
      )}

      <Pressable style={styles.leaveButton} onPress={handleLeave} disabled={isBusy}>
        {isBusy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.leaveButtonText}>Leave household</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  container: { padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.background },
  intro: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  householdName: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  section: { gap: spacing.sm + 2 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.textPrimary,
  },
  button: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md + 2, alignItems: "center" },
  buttonText: { color: colors.textInverse, fontSize: 15, fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
  },
  secondaryButtonText: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  inviteCode: { fontSize: 18, fontWeight: "700", letterSpacing: 2, color: colors.textPrimary },
  copyLabel: { fontSize: 14, fontWeight: "600", color: colors.accent },
  memberRow: { fontSize: 14, color: colors.textSecondary, paddingVertical: spacing.xs },
  leaveButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
  },
  leaveButtonText: { color: colors.danger, fontSize: 15, fontWeight: "600" },
});
