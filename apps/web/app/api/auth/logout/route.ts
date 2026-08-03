import { NextResponse } from "next/server";
import { clearTokens } from "@/lib/server/session";

// Mirrors the mobile app: sign-out is purely local (clearing the session), no backend call.
export async function POST() {
  await clearTokens();
  return NextResponse.json({ signedOut: true });
}
