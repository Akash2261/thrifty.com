import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { DataUsageItem } from "@thrifty/shared";
import { ApiError } from "../../src/api/client";
import { fetchAccountExportCsv, getDataUsage } from "../../src/api/account";
import { colors, radii, spacing } from "../../src/theme/colors";

export default function DataUsageScreen() {
  const [items, setItems] = useState<DataUsageItem[] | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    getDataUsage()
      .then(({ items: fetched }) => setItems(fetched))
      .catch(() => setItems([]));
  }, []);

  async function handleExport() {
    setIsExporting(true);
    try {
      const csv = await fetchAccountExportCsv();
      const fileUri = `${FileSystem.cacheDirectory}thrifty-export.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Export your Thrifty data" });
      } else {
        Alert.alert("Export ready", `Saved to ${fileUri}`);
      }
    } catch (err) {
      Alert.alert("Couldn't export", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>What Thrifty reads from your connected accounts, and why.</Text>

      {items === null ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        items.map((item) => (
          <View key={item.category} style={styles.card}>
            <Text style={styles.category}>{item.category}</Text>
            <Text style={styles.label}>What we read</Text>
            <Text style={styles.body}>{item.whatWeRead}</Text>
            <Text style={styles.label}>Why</Text>
            <Text style={styles.body}>{item.why}</Text>
          </View>
        ))
      )}

      <Pressable style={styles.exportButton} onPress={handleExport} disabled={isExporting}>
        {isExporting ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.exportButtonText}>Export my data (CSV)</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.background },
  intro: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.lg, gap: 4 },
  category: { fontSize: 15, fontWeight: "700", marginBottom: spacing.xs, color: colors.textPrimary },
  label: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm - 2 },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  exportButton: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md + 2, alignItems: "center", marginTop: spacing.sm },
  exportButtonText: { color: colors.textInverse, fontSize: 15, fontWeight: "600" },
});
