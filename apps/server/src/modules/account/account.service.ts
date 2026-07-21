import { prisma } from "../../db/prisma";
import type { DataUsageItem } from "@thrifty/shared";

// A DPDP-oriented (India's Digital Personal Data Protection Act) explainability screen — plain-
// language answers to "what does Thrifty read from my connected accounts, and why." Reflects
// which connections the user actually has, rather than describing every integration generically.
export async function getDataUsage(userId: string): Promise<DataUsageItem[]> {
  const [emailConnections, whatsAppConnection, linkedBankAccounts] = await Promise.all([
    prisma.emailConnection.findMany({ where: { userId } }),
    prisma.whatsAppConnection.findFirst({ where: { userId } }),
    prisma.linkedBankAccount.findMany({ where: { userId } }),
  ]);

  const items: DataUsageItem[] = [
    {
      category: "Receipt photos & forwarded emails",
      whatWeRead: "The image or text you send us, plus the extracted item name, price, and purchase date.",
      why: "To calculate your return-window and warranty deadlines and remind you before they close.",
    },
  ];

  if (emailConnections.length > 0) {
    items.push({
      category: `Connected email (${emailConnections.map((c) => c.provider).join(", ")})`,
      whatWeRead:
        "Order-confirmation and shipping emails matching known retailer patterns — not your full inbox, and not personal correspondence.",
      why: "To automatically capture receipts and detect subscription-billing emails without you forwarding each one manually.",
    });
  }

  if (whatsAppConnection) {
    items.push({
      category: "WhatsApp messages",
      whatWeRead: "Photos and text messages you send to Thrifty's WhatsApp number only.",
      why: "To extract and track warranty items the same way as the in-app camera capture.",
    });
  }

  if (linkedBankAccounts.length > 0) {
    items.push({
      category: "Bank transactions (via Account Aggregator)",
      whatWeRead: "Transaction amounts, dates, and merchant names — read-only, never your login credentials.",
      why: "To detect recurring subscription charges and calculate your total monthly spend.",
    });
  }

  items.push({
    category: "Notifications",
    whatWeRead: "Nothing new — this uses the data above to decide when to remind you.",
    why: "To alert you before a return window or warranty closes, or about subscriptions you might not be using.",
  });

  return items;
}
