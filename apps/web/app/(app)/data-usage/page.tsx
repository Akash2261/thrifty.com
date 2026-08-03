"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DataUsageItem } from "@thrifty/shared";
import { Card } from "@/components/Card";
import { getDataUsage } from "@/lib/api/account";

export default function DataUsagePage() {
  const router = useRouter();
  const [items, setItems] = useState<DataUsageItem[] | null>(null);

  useEffect(() => {
    getDataUsage()
      .then(({ items: fetched }) => setItems(fetched))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => router.push("/settings")} className="self-start text-sm font-medium text-accent">
        ← Back
      </button>

      <h1 className="text-2xl font-bold text-ink">What we read from your data</h1>

      {items === null ? (
        <p className="text-sm text-ink-secondary">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.category} className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-ink">{item.category}</p>
              <p className="text-sm text-ink-secondary">
                <span className="font-medium text-ink">What we read: </span>
                {item.whatWeRead}
              </p>
              <p className="text-sm text-ink-secondary">
                <span className="font-medium text-ink">Why: </span>
                {item.why}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
