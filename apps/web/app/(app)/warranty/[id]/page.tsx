"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ClaimType, WarrantyItem } from "@thrifty/shared";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { ApiError } from "@/lib/api/client";
import { getWarrantyItem, receiptImageUrl, updateWarrantyItem } from "@/lib/api/warranty";
import { createClaim } from "@/lib/api/claims";
import { nextDeadline } from "@/lib/warrantyDisplay";

export default function WarrantyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<WarrantyItem | null>(null);
  const [itemName, setItemName] = useState("");
  const [retailer, setRetailer] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [claimNotice, setClaimNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWarrantyItem(id).then(({ item: fetched }) => {
      setItem(fetched);
      setItemName(fetched.itemName);
      setRetailer(fetched.retailer ?? "");
    });
  }, [id]);

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      const { item: updated } = await updateWarrantyItem(id, { itemName, retailer: retailer || null });
      setItem(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your changes.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFileClaim(type: ClaimType) {
    setError(null);
    setClaimNotice(null);
    try {
      const { claim } = await createClaim({ warrantyItemId: id, type });
      if (claim.serviceCenterContact) {
        setClaimNotice(
          `Claim filed. Contact ${claim.serviceCenterContact.displayName} via ${claim.serviceCenterContact.contactMethod}: ${claim.serviceCenterContact.contactValue}. ${claim.serviceCenterContact.instructions}`,
        );
      } else {
        setClaimNotice("Claim filed — we'll follow up with next steps once we identify a service center.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't file that claim.");
    }
  }

  if (!item) return <p className="text-sm text-ink-secondary">Loading…</p>;

  const returnDeadline = item.returnWindowEndsAt ? nextDeadline({ ...item, warrantyEndsAt: null }) : null;
  const warrantyDeadline = item.warrantyEndsAt ? nextDeadline({ ...item, returnWindowEndsAt: null }) : null;
  const warrantyEndingSoon =
    item.warrantyEndsAt && warrantyDeadline && warrantyDeadline.days >= 0 && warrantyDeadline.days <= 30;

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => router.push("/warranty")} className="text-sm font-medium text-accent">
        ← Back
      </button>

      {item.sourceImageUrl ? (
        <img
          src={receiptImageUrl(item.id)}
          alt={item.itemName}
          className="max-h-80 w-full rounded-lg border border-border object-contain"
        />
      ) : null}

      <Card className="flex flex-col gap-3">
        {returnDeadline ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-secondary">Return window</span>
            <Badge tone={returnDeadline.urgent ? "urgent" : "neutral"}>{returnDeadline.label}</Badge>
          </div>
        ) : null}
        {warrantyDeadline ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-secondary">Warranty</span>
            <Badge tone={warrantyDeadline.urgent ? "urgent" : "neutral"}>{warrantyDeadline.label}</Badge>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-secondary">Purchased</span>
          <span className="text-ink">{new Date(item.purchaseDate).toLocaleDateString()}</span>
        </div>
        {item.price !== null ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-secondary">Price</span>
            <span className="text-ink">
              {item.currency ?? ""} {item.price.toFixed(2)}
            </span>
          </div>
        ) : null}
      </Card>

      {warrantyEndingSoon ? (
        <Card className="bg-accent-soft">
          <p className="text-sm text-ink">
            Your warranty on this item ends soon — extended warranty options are coming to Thrifty
            shortly.
          </p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <TextField label="Item name" name="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} />
        <TextField label="Retailer" name="retailer" value={retailer} onChange={(e) => setRetailer(e.target.value)} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button onClick={handleSave} disabled={isSaving} className="self-start">
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink">File a claim</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => handleFileClaim("warranty_defect")}>
            It&apos;s defective
          </Button>
          <Button variant="secondary" onClick={() => handleFileClaim("return_assistance")}>
            Help with a return
          </Button>
        </div>
        {claimNotice ? <p className="text-sm text-ink-secondary">{claimNotice}</p> : null}
      </Card>
    </div>
  );
}
