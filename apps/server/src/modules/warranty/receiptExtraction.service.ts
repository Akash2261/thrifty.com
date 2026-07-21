import Anthropic from "@anthropic-ai/sdk";
import { ExtractedReceiptSchema, type ExtractedReceipt } from "@thrifty/shared";
import { AppError } from "../../lib/errors";

const RECORD_RECEIPT_TOOL = {
  name: "record_receipt",
  description: "Record the structured data extracted from a purchase receipt.",
  input_schema: {
    type: "object" as const,
    properties: {
      itemName: {
        type: "string",
        description: "The main item or a short summary of the items purchased.",
      },
      retailer: {
        type: ["string", "null"],
        description: "The store or retailer name, or null if it can't be determined.",
      },
      purchaseDate: {
        type: ["string", "null"],
        description: "The purchase date in YYYY-MM-DD format, or null if not visible.",
      },
      price: {
        type: ["number", "null"],
        description: "The total price paid, or null if not visible.",
      },
      currency: {
        type: ["string", "null"],
        description: "The ISO 4217 currency code (e.g. USD, INR), or null if not determinable.",
      },
    },
    required: ["itemName", "retailer", "purchaseDate", "price", "currency"],
  },
};

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AppError(
        "Receipt scanning isn't set up yet on the server (missing ANTHROPIC_API_KEY).",
        503,
      );
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

async function runExtraction(content: Anthropic.MessageParam["content"]): Promise<ExtractedReceipt> {
  const anthropic = getClient();

  let message: Anthropic.Message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: [RECORD_RECEIPT_TOOL],
      tool_choice: { type: "tool", name: "record_receipt" },
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    console.error("Claude receipt extraction request failed", err);
    throw new AppError("Couldn't read that receipt. Please try again.", 502);
  }

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new AppError("Couldn't read that receipt. Please try again.", 502);
  }

  return ExtractedReceiptSchema.parse(toolUse.input);
}

export function extractReceiptFromImage(
  imageBuffer: Buffer,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<ExtractedReceipt> {
  return runExtraction([
    {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: imageBuffer.toString("base64") },
    },
    {
      type: "text",
      text: "Extract the purchase details from this receipt image and record them with the record_receipt tool.",
    },
  ]);
}

export function extractReceiptFromEmailText(emailText: string): Promise<ExtractedReceipt> {
  return runExtraction([
    {
      type: "text",
      text:
        "Extract the purchase details from this forwarded receipt/order-confirmation email and " +
        `record them with the record_receipt tool.\n\n---\n${emailText}\n---`,
    },
  ]);
}
