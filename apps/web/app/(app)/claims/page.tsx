"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Claim } from "@thrifty/shared";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { listClaims } from "@/lib/api/claims";

const TYPE_LABELS: Record<Claim["type"], string> = {
  warranty_defect: "Defective item",
  return_assistance: "Return assistance",
};

export default function ClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[] | null>(null);

  useEffect(() => {
    listClaims()
      .then(({ claims: fetched }) => setClaims(fetched))
      .catch(() => setClaims([]));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => router.push("/settings")} className="self-start text-sm font-medium text-accent">
        ← Back
      </button>

      <h1 className="text-2xl font-bold text-ink">Your claims</h1>

      {claims === null ? (
        <p className="text-sm text-ink-secondary">Loading…</p>
      ) : claims.length === 0 ? (
        <EmptyState
          title="No claims yet"
          description="File a claim from any warranty item's page if something's defective or you need return help."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {claims.map((claim) => (
            <Card key={claim.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{claim.warrantyItemName}</p>
                <Badge tone={claim.status === "resolved" ? "accent" : "neutral"}>{claim.status}</Badge>
              </div>
              <p className="text-xs text-ink-secondary">{TYPE_LABELS[claim.type]}</p>
              {claim.description ? <p className="text-sm text-ink-secondary">{claim.description}</p> : null}
              {claim.serviceCenterContact ? (
                <p className="text-xs text-ink-secondary">
                  Contact: {claim.serviceCenterContact.displayName} via{" "}
                  {claim.serviceCenterContact.contactMethod} — {claim.serviceCenterContact.contactValue}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
