import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { Claim } from "@thrifty/shared";
import { listClaims } from "../../src/api/claims";
import { colors, radii, spacing } from "../../src/theme/colors";

const TYPE_LABEL: Record<Claim["type"], string> = {
  warranty_defect: "Defect claim",
  return_assistance: "Return assistance",
};

const STATUS_LABEL: Record<Claim["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  resolved: "Resolved",
};

export default function ClaimsScreen() {
  const [claims, setClaims] = useState<Claim[] | null>(null);

  const load = useCallback(async () => {
    try {
      const { claims: fetched } = await listClaims();
      setClaims(fetched);
    } catch {
      // keep whatever was already on screen
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (claims === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={claims}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            No claims yet — file one from a warranty item's detail screen.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.itemName}>{item.warrantyItemName}</Text>
          <Text style={styles.meta}>
            {TYPE_LABEL[item.type]} · {STATUS_LABEL[item.status]}
          </Text>
          {item.serviceCenterContact && (
            <Text style={styles.contact}>
              {item.serviceCenterContact.displayName}: {item.serviceCenterContact.contactValue}
            </Text>
          )}
          {item.description && <Text style={styles.description}>{item.description}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxxl, backgroundColor: colors.background },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  listContent: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.lg, gap: spacing.xs, marginBottom: spacing.md },
  itemName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textMuted },
  contact: { fontSize: 13, color: colors.textPrimary, fontWeight: "600", marginTop: spacing.xs },
  description: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
});
