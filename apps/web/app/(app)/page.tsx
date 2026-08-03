"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DetectedSubscription, WarrantyItem } from "@thrifty/shared";
import { Card } from "@/components/Card";
import { cn } from "@/lib/cn";
import { useSession } from "@/context/session-context";
import { listWarrantyItems } from "@/lib/api/warranty";
import { listSubscriptions } from "@/lib/api/substop";
import { nextDeadline } from "@/lib/warrantyDisplay";
import { displayIdentity } from "@/lib/userDisplay";

type FilterKind = "all" | "warranty" | "return" | "subscription";

interface DashboardEntry {
  id: string;
  kind: "warranty" | "return" | "subscription";
  title: string;
  subtitle: string;
  urgent: boolean;
  sortValue: number;
  onSelect: () => void;
}

const FILTERS: { key: FilterKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "warranty", label: "Warranties" },
  { key: "return", label: "Returns" },
  { key: "subscription", label: "Subscriptions" },
];

export default function HomePage() {
  const { user } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<WarrantyItem[]>([]);
  const [subs, setSubs] = useState<DetectedSubscription[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [currency, setCurrency] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>("all");

  useEffect(() => {
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
  }, []);

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
          onSelect: () => router.push(`/warranty/${item.id}`),
        };
      })
      .filter((e): e is DashboardEntry => e !== null);

    const subscriptionEntries: DashboardEntry[] = subs.map((sub) => ({
      id: sub.id,
      kind: "subscription",
      title: sub.displayName,
      subtitle: `${sub.currency} ${sub.avgAmount.toFixed(2)}/${sub.cadence}`,
      urgent: false,
      sortValue: -sub.avgAmount,
      onSelect: () => router.push("/substop"),
    }));

    return [...warrantyEntries, ...subscriptionEntries].sort((a, b) => a.sortValue - b.sortValue);
  }, [items, subs, router]);

  const visibleEntries = filter === "all" ? entries : entries.filter((e) => e.kind === filter);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">Hi{user ? `, ${displayIdentity(user)}` : ""} 👋</h1>

      <Card className="border-none bg-primary text-ink-inverse">
        <p className="text-xs opacity-65">Total value at stake</p>
        <p className="text-3xl font-bold">
          {currency ?? ""} {totalValueAtStake.toFixed(2)}
        </p>
        <p className="mt-1 text-xs opacity-55">Active warranty items + monthly subscription spend</p>
      </Card>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-pill px-4 py-2 text-xs font-semibold transition-colors",
              filter === f.key ? "bg-primary text-ink-inverse" : "bg-surface-alt text-ink-secondary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibleEntries.length === 0 ? (
        <Card className="bg-surface-alt">
          <p className="text-sm leading-relaxed text-ink-secondary">
            Nothing here yet. Upload a receipt in the Warranty tab or link a bank in SubStop to get
            started.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleEntries.map((entry) => (
            <button
              key={`${entry.kind}-${entry.id}`}
              onClick={entry.onSelect}
              className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-alt"
            >
              <span className="mr-2 flex-1 truncate text-sm font-semibold text-ink">{entry.title}</span>
              <span className={cn("text-xs", entry.urgent ? "font-bold text-ink" : "text-ink-secondary")}>
                {entry.subtitle}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
