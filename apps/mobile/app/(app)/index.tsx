import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { DetectedSubscription, WarrantyItem } from "@thrifty/shared";
import { useSession } from "../../src/ctx/auth";
import { listWarrantyItems } from "../../src/api/warranty";
import { listSubscriptions } from "../../src/api/substop";
import { nextDeadline } from "../../src/lib/warrantyDisplay";
import { displayIdentity } from "../../src/lib/userDisplay";
import { cardShadow, colors, radii, spacing } from "../../src/theme/colors";

type FilterKind = "all" | "warranty" | "return" | "subscription";

interface DashboardEntry {
  id: string;
  kind: "warranty" | "return" | "subscription";
  title: string;
  subtitle: string;
  urgent: boolean;
  sortValue: number;
  onPress: () => void;
}

const FILTERS: { key: FilterKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "warranty", label: "Warranties" },
  { key: "return", label: "Returns" },
  { key: "subscription", label: "Subscriptions" },
];

export default function HomeScreen() {
  const { user } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<WarrantyItem[]>([]);
  const [subs, setSubs] = useState<DetectedSubscription[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [currency, setCurrency] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>("all");

  useFocusEffect(
    useCallback(() => {
      listWarrantyItems()
        .then(({ items: fetched }) => setItems(fetched))
        .catch(() => {});

      listSubscriptions()
        .then((result) => {
          setSubs(result.items);
          setMonthlyTotal(result.monthlyTotal);
          setCurrency((prev) => result.currency ?? prev);
        })
        .catch(() => {});
    }, []),
  );

  const totalValueAtStake = useMemo(() => {
    const activeItemsValue = items
      .filter((item) => item.status !== "expired")
      .reduce((sum, item) => sum + (item.price ?? 0), 0);
    return activeItemsValue + monthlyTotal;
  }, [items, monthlyTotal]);

  const entries = useMemo<DashboardEntry[]>(() => {
    const warrantyEntries: DashboardEntry[] = items
      .map((item): DashboardEntry | null => {
        const deadline = nextDeadline(item);
        if (!deadline || deadline.days < 0) return null;
        return {
          id: item.id,
          kind: deadline.kind,
          title: item.itemName,
          subtitle: deadline.label,
          urgent: deadline.urgent,
          sortValue: deadline.days,
          onPress: () => router.push({ pathname: "/warranty/[id]", params: { id: item.id } }),
        };
      })
      .filter((e): e is DashboardEntry => e !== null);

    const subscriptionEntries: DashboardEntry[] = subs.map((sub) => ({
      id: sub.id,
      kind: "subscription",
      title: sub.displayName,
      subtitle: `${sub.currency} ${sub.avgAmount.toFixed(2)}/${sub.cadence}`,
      urgent: false,
      sortValue: -sub.avgAmount, // higher spend sorts first
      onPress: () => router.push("/substop"),
    }));

    return [...warrantyEntries, ...subscriptionEntries].sort((a, b) => a.sortValue - b.sortValue);
  }, [items, subs, router]);

  const visibleEntries = filter === "all" ? entries : entries.filter((e) => e.kind === filter);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>Hi{user ? `, ${displayIdentity(user)}` : ""} 👋</Text>

      <View style={styles.stakeCard}>
        <Text style={styles.stakeLabel}>Total value at stake</Text>
        <Text style={styles.stakeAmount}>
          {currency ?? ""} {totalValueAtStake.toFixed(2)}
        </Text>
        <Text style={styles.stakeSub}>Active warranty items + monthly subscription spend</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {visibleEntries.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            Nothing here yet. Snap a receipt in the Warranty tab or link a bank in SubStop to get
            started.
          </Text>
        </View>
      ) : (
        visibleEntries.map((entry) => (
          <Pressable key={`${entry.kind}-${entry.id}`} style={styles.row} onPress={entry.onPress}>
            <Text style={styles.rowTitle}>{entry.title}</Text>
            <Text style={[styles.rowSubtitle, entry.urgent && styles.rowSubtitleUrgent]}>{entry.subtitle}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  greeting: { fontSize: 24, fontWeight: "700", marginBottom: spacing.xs, color: colors.textPrimary },
  stakeCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: 2,
    marginBottom: spacing.xs,
    ...cardShadow,
  },
  stakeLabel: { color: colors.textInverse, opacity: 0.65, fontSize: 13 },
  stakeAmount: { color: colors.textInverse, fontSize: 32, fontWeight: "700" },
  stakeSub: { color: colors.textInverse, opacity: 0.55, fontSize: 12, marginTop: spacing.xs },
  filterRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  filterChipTextActive: { color: colors.textInverse },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: radii.lg, padding: spacing.lg },
  cardBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: "600", flex: 1, marginRight: spacing.sm, color: colors.textPrimary },
  rowSubtitle: { fontSize: 13, color: colors.textSecondary },
  rowSubtitleUrgent: { color: colors.textPrimary, fontWeight: "700" },
});
