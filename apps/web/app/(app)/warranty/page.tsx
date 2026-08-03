"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { WarrantyItem } from "@thrifty/shared";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ApiError } from "@/lib/api/client";
import { listWarrantyItems, uploadReceipt } from "@/lib/api/warranty";
import { nextDeadline } from "@/lib/warrantyDisplay";
import { resizeImageForUpload } from "@/lib/resizeImage";

export default function WarrantyListPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<WarrantyItem[] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    listWarrantyItems()
      .then(({ items: fetched }) => setItems(fetched))
      .catch(() => setItems([]));
  }

  useEffect(load, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setIsUploading(true);
    try {
      const resized = await resizeImageForUpload(file);
      const { item } = await uploadReceipt(resized);
      router.push(`/warranty/${item.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setError("You've reached the free plan's 5-item limit. Upgrade to add more.");
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't upload that receipt.");
      }
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Warranty Wallet</h1>
        <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? "Uploading…" : "+ Add receipt"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {items === null ? (
        <p className="text-sm text-ink-secondary">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No receipts yet"
          description="Add a receipt photo and Thrifty will track its return window and warranty deadline automatically."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const deadline = nextDeadline(item);
            return (
              <button
                key={item.id}
                onClick={() => router.push(`/warranty/${item.id}`)}
                className="w-full text-left"
              >
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{item.itemName}</p>
                    {item.retailer ? (
                      <p className="truncate text-xs text-ink-secondary">{item.retailer}</p>
                    ) : null}
                  </div>
                  {deadline ? (
                    <Badge tone={deadline.urgent ? "urgent" : "neutral"} className="shrink-0">
                      {deadline.label}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" className="shrink-0">
                      {item.status}
                    </Badge>
                  )}
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
