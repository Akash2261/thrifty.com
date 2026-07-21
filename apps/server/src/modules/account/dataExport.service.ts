import { prisma } from "../../db/prisma";

function csvEscape(value: string | number | null): string {
  if (value === null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values: (string | number | null)[]): string {
  return values.map(csvEscape).join(",") + "\n";
}

// A single flat CSV, sectioned by heading rows — simplest format a spreadsheet app or
// non-technical user can open directly. JSON/PDF export can be added later if requested; this
// bounded scope covers the DPDP-relevant "give me my data" ask.
export async function buildAccountExportCsv(userId: string): Promise<string> {
  const [warrantyItems, subscriptions, cancellationRequests] = await Promise.all([
    prisma.warrantyItem.findMany({ where: { userId } }),
    prisma.detectedSubscription.findMany({ where: { userId } }),
    prisma.cancellationRequest.findMany({ where: { userId } }),
  ]);

  let csv = "";

  csv += toCsvRow(["Warranty Items"]);
  csv += toCsvRow(["Item", "Retailer", "Purchase Date", "Price", "Currency", "Return Window Ends", "Warranty Ends", "Status"]);
  for (const item of warrantyItems) {
    csv += toCsvRow([
      item.itemName,
      item.retailer,
      item.purchaseDate.toISOString().slice(0, 10),
      item.price,
      item.currency,
      item.returnWindowEndsAt?.toISOString().slice(0, 10) ?? null,
      item.warrantyEndsAt?.toISOString().slice(0, 10) ?? null,
      item.status,
    ]);
  }

  csv += toCsvRow([]);
  csv += toCsvRow(["Subscriptions"]);
  csv += toCsvRow(["Name", "Amount", "Currency", "Cadence", "Status", "Detected From"]);
  for (const sub of subscriptions) {
    const sources = [sub.detectedFromBank && "bank", sub.detectedFromEmail && "email"].filter(Boolean).join(" + ");
    csv += toCsvRow([sub.displayName, sub.avgAmount, sub.currency, sub.cadence, sub.status, sources || null]);
  }

  csv += toCsvRow([]);
  csv += toCsvRow(["Cancellation Requests"]);
  csv += toCsvRow(["Method", "Status", "Sent At"]);
  for (const req of cancellationRequests) {
    csv += toCsvRow([req.method, req.status, req.sentAt?.toISOString() ?? null]);
  }

  return csv;
}
