import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
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
import type { WarrantyItem } from "@thrifty/shared";
import { listWarrantyItems, uploadReceipt } from "../../../src/api/warranty";
import { ApiError } from "../../../src/api/client";
import { nextDeadline } from "../../../src/lib/warrantyDisplay";
import { useUpgrade } from "../../../src/hooks/useUpgrade";
import { track } from "../../../src/lib/analytics";
import { cardShadow, colors, radii, spacing } from "../../../src/theme/colors";

// Phone cameras routinely produce 12MP+ photos — far more resolution than Claude's vision API
// needs to read a receipt, and a needless multi-MB upload on a slow connection. Downscaling to a
// bounded width before upload cuts upload time/cost with no meaningful loss of legibility.
const MAX_UPLOAD_WIDTH = 1600;

async function compressReceiptImage(asset: ImagePicker.ImagePickerAsset): Promise<{ uri: string; mimeType: string }> {
  try {
    const actions = asset.width && asset.width > MAX_UPLOAD_WIDTH ? [{ resize: { width: MAX_UPLOAD_WIDTH } }] : [];
    const result = await manipulateAsync(asset.uri, actions, { compress: 0.6, format: SaveFormat.JPEG });
    return { uri: result.uri, mimeType: "image/jpeg" };
  } catch {
    // Compression is a perf optimization, not a correctness requirement — fall back to the
    // original image rather than blocking the upload if it fails for any reason.
    return { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" };
  }
}

export default function WarrantyListScreen() {
  const router = useRouter();
  const { startUpgrade } = useUpgrade();
  const [items, setItems] = useState<WarrantyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { items: fetched } = await listWarrantyItems();
      setItems(fetched);
    } catch {
      // leave the previous list visible; the pull-to-refresh spinner already communicates failure
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handlePick(source: "camera" | "library") {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission needed", "Thrifty needs this permission to scan a receipt.");
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setIsUploading(true);
    try {
      const wasFirstItem = items.length === 0;
      const compressed = await compressReceiptImage(asset);
      const { item } = await uploadReceipt({
        uri: compressed.uri,
        name: asset.fileName ?? "receipt.jpg",
        type: compressed.mimeType,
      });
      track("warranty_item_created", { source, isFirstItem: wasFirstItem });
      await load();
      router.push({ pathname: "/warranty/[id]", params: { id: item.id } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        Alert.alert("Free plan limit reached", err.message, [
          { text: "Upgrade", onPress: startUpgrade },
          { text: "Not now", style: "cancel" },
        ]);
        return;
      }
      const message = err instanceof ApiError ? err.message : "Couldn't process that receipt. Try again.";
      Alert.alert("Scan failed", message);
    } finally {
      setIsUploading(false);
    }
  }

  function confirmSource() {
    Alert.alert("Add a receipt", undefined, [
      { text: "Take Photo", onPress: () => handlePick("camera") },
      { text: "Choose from Library", onPress: () => handlePick("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
        contentContainerStyle={[styles.listContent, items.length === 0 && styles.emptyContainer]}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No receipts yet</Text>
              <Text style={styles.emptyBody}>
                Snap a photo of a receipt and Thrifty will find its return window and warranty
                expiry automatically.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const deadline = nextDeadline(item);
          return (
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: "/warranty/[id]", params: { id: item.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.itemName}
                </Text>
                <Text style={styles.rowSubtitle}>{item.retailer ?? "Unknown retailer"}</Text>
                {deadline && (
                  <Text style={[styles.badge, deadline.urgent && styles.badgeUrgent]}>{deadline.label}</Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={confirmSource} disabled={isUploading}>
        {isUploading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.fabText}>+ Add receipt</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: colors.textPrimary },
  emptyBody: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  listContent: { paddingBottom: 96, paddingTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
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
  badge: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  badgeUrgent: { color: colors.textPrimary, fontWeight: "700" },
  fab: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xxl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    ...cardShadow,
    shadowOpacity: 0.24,
  },
  fabText: { color: colors.textInverse, fontWeight: "600", fontSize: 15 },
});
