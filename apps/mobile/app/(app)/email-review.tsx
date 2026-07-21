import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ReviewEmailItem } from "@thrifty/shared";
import { ApiError } from "../../src/api/client";
import { approveReviewItem, listReviewQueue, rejectReviewItem } from "../../src/api/emailConnections";
import { track } from "../../src/lib/analytics";
import { colors, radii, spacing } from "../../src/theme/colors";

interface Draft {
  itemName: string;
  retailer: string;
  price: string;
}

function draftFrom(item: ReviewEmailItem): Draft {
  return {
    itemName: item.extractedItemName ?? "",
    retailer: item.extractedRetailer ?? "",
    price: item.extractedPrice != null ? String(item.extractedPrice) : "",
  };
}

export default function EmailReviewScreen() {
  const [items, setItems] = useState<ReviewEmailItem[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { items: fetched } = await listReviewQueue();
      setItems(fetched);
      setDrafts(Object.fromEntries(fetched.map((item) => [item.id, draftFrom(item)])));
    } catch {
      // keep whatever was already on screen
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleApprove(item: ReviewEmailItem) {
    const draft = drafts[item.id];
    if (!draft?.itemName.trim()) {
      Alert.alert("Item name required", "Enter what this receipt was for before saving.");
      return;
    }
    setBusyId(item.id);
    try {
      await approveReviewItem(item.id, {
        itemName: draft.itemName.trim(),
        retailer: draft.retailer.trim() || null,
        price: draft.price.trim() ? Number(draft.price) : null,
      });
      track("email_receipt_approved", { fromReview: true });
      await load();
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(item: ReviewEmailItem) {
    setBusyId(item.id);
    try {
      await rejectReviewItem(item.id);
      await load();
    } catch (err) {
      Alert.alert("Couldn't dismiss", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setBusyId(null);
    }
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  if (items === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No emails waiting for review right now.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const draft = drafts[item.id] ?? draftFrom(item);
        const isBusy = busyId === item.id;
        return (
          <View style={styles.card}>
            <Text style={styles.subject} numberOfLines={1}>
              {item.subject}
            </Text>
            <Text style={styles.from} numberOfLines={1}>
              {item.fromAddress}
            </Text>

            <Text style={styles.label}>Item</Text>
            <TextInput
              style={styles.input}
              value={draft.itemName}
              onChangeText={(text) => updateDraft(item.id, { itemName: text })}
              placeholder="What was this?"
            />

            <Text style={styles.label}>Retailer</Text>
            <TextInput
              style={styles.input}
              value={draft.retailer}
              onChangeText={(text) => updateDraft(item.id, { retailer: text })}
              placeholder="Optional"
            />

            <Text style={styles.label}>Price</Text>
            <TextInput
              style={styles.input}
              value={draft.price}
              onChangeText={(text) => updateDraft(item.id, { price: text })}
              placeholder="Optional"
              keyboardType="decimal-pad"
            />

            {isBusy ? (
              <ActivityIndicator style={{ marginTop: 12 }} />
            ) : (
              <View style={styles.actions}>
                <Pressable style={styles.rejectButton} onPress={() => handleReject(item)}>
                  <Text style={styles.rejectButtonText}>Not a receipt</Text>
                </Pressable>
                <Pressable style={styles.approveButton} onPress={() => handleApprove(item)}>
                  <Text style={styles.approveButtonText}>Save item</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxxl, backgroundColor: colors.background },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  listContent: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.lg, gap: spacing.sm - 2, marginBottom: spacing.md },
  subject: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  from: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm - 2 },
  label: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  actions: { flexDirection: "row", gap: spacing.sm + 2, marginTop: spacing.md },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  rejectButtonText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  approveButton: { flex: 1, backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: "center" },
  approveButtonText: { fontSize: 14, fontWeight: "600", color: colors.textInverse },
});
