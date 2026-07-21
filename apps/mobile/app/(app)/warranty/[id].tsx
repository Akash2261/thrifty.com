import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { WarrantyItem } from "@thrifty/shared";
import { daysUntil } from "@thrifty/shared";
import { API_BASE_URL, ApiError } from "../../../src/api/client";
import { authorizedAccessToken } from "../../../src/api/authClient";
import { getWarrantyItem, updateWarrantyItem } from "../../../src/api/warranty";
import { createClaim } from "../../../src/api/claims";
import { colors, radii, spacing } from "../../../src/theme/colors";

const EXTENDED_WARRANTY_WINDOW_DAYS = 30;

export default function WarrantyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<WarrantyItem | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftRetailer, setDraftRetailer] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [{ item: fetched }, token] = await Promise.all([
          getWarrantyItem(id),
          authorizedAccessToken(),
        ]);
        setItem(fetched);
        setDraftName(fetched.itemName);
        setDraftRetailer(fetched.retailer ?? "");
        setAccessToken(token);
      } catch (err) {
        Alert.alert("Couldn't load item", err instanceof ApiError ? err.message : "Try again.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  function handleFileClaim() {
    if (!item) return;
    Alert.alert("File a claim", "What's this claim for?", [
      { text: "It's defective", onPress: () => submitClaim("warranty_defect") },
      { text: "Help with a return", onPress: () => submitClaim("return_assistance") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function submitClaim(type: "warranty_defect" | "return_assistance") {
    if (!item) return;
    try {
      const { claim } = await createClaim({ warrantyItemId: item.id, type });
      Alert.alert(
        "Claim filed",
        claim.serviceCenterContact
          ? `Contact ${claim.serviceCenterContact.displayName} via ${claim.serviceCenterContact.contactMethod}: ${claim.serviceCenterContact.contactValue}`
          : "We don't have a verified service-center contact for this yet — check the manufacturer's own site or included documentation.",
      );
    } catch (err) {
      Alert.alert("Couldn't file claim", err instanceof ApiError ? err.message : "Try again.");
    }
  }

  async function handleSave() {
    if (!item) return;
    setIsSaving(true);
    try {
      const { item: updated } = await updateWarrantyItem(item.id, {
        itemName: draftName.trim(),
        retailer: draftRetailer.trim() || null,
      });
      setItem(updated);
      Alert.alert("Saved");
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text>Item not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {item.sourceImageUrl && accessToken && (
        <Image
          source={{
            uri: `${API_BASE_URL}${item.sourceImageUrl}`,
            headers: { Authorization: `Bearer ${accessToken}` },
          }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      <DeadlineRow label="Return window" isoDate={item.returnWindowEndsAt} />
      <DeadlineRow label="Warranty" isoDate={item.warrantyEndsAt} />
      <ExtendedWarrantyCard isoDate={item.warrantyEndsAt} />

      <Text style={styles.label}>Item</Text>
      <TextInput style={styles.input} value={draftName} onChangeText={setDraftName} />

      <Text style={styles.label}>Retailer</Text>
      <TextInput style={styles.input} value={draftRetailer} onChangeText={setDraftRetailer} />

      <Text style={styles.label}>Purchase date</Text>
      <Text style={styles.value}>{new Date(item.purchaseDate).toLocaleDateString()}</Text>

      {item.price != null && (
        <>
          <Text style={styles.label}>Price</Text>
          <Text style={styles.value}>
            {item.currency ?? ""} {item.price.toFixed(2)}
          </Text>
        </>
      )}

      <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveButtonText}>Save changes</Text>}
      </Pressable>

      <Pressable style={styles.claimButton} onPress={handleFileClaim}>
        <Text style={styles.claimButtonText}>File a claim</Text>
      </Pressable>
    </ScrollView>
  );
}

function ExtendedWarrantyCard({ isoDate }: { isoDate: string | null }) {
  if (!isoDate) return null;
  const days = daysUntil(isoDate);
  if (days < 0 || days > EXTENDED_WARRANTY_WINDOW_DAYS) return null;

  return (
    <View style={styles.extendedCard}>
      <Text style={styles.extendedTitle}>Extended warranty available soon</Text>
      <Text style={styles.extendedBody}>
        Your warranty is ending — extended coverage options aren't set up yet, but check back here
        before it closes.
      </Text>
    </View>
  );
}

function DeadlineRow({ label, isoDate }: { label: string; isoDate: string | null }) {
  if (!isoDate) return null;
  const days = daysUntil(isoDate);
  const text =
    days < 0
      ? `${label} closed ${Math.abs(days)} day(s) ago`
      : days === 0
        ? `${label} closes today`
        : `${label} closes in ${days} day${days === 1 ? "" : "s"}`;
  const isUrgent = days <= 3 && days >= 0;
  return (
    <View style={[styles.deadlineCard, isUrgent && styles.deadlineCardUrgent]}>
      <Text style={[styles.deadlineText, isUrgent && styles.deadlineTextUrgent]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  image: { width: "100%", height: 220, borderRadius: radii.md, backgroundColor: colors.surfaceAlt },
  deadlineCard: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md },
  deadlineCardUrgent: { backgroundColor: colors.primary },
  deadlineText: { fontSize: 14, fontWeight: "500", color: colors.textPrimary },
  deadlineTextUrgent: { color: colors.textInverse, fontWeight: "700" },
  label: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  value: { fontSize: 16, color: colors.textPrimary },
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
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  saveButtonText: { color: colors.textInverse, fontSize: 16, fontWeight: "600" },
  claimButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  claimButtonText: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  extendedCard: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  extendedTitle: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  extendedBody: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
