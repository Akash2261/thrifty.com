import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/server/backend";

export async function POST(req: NextRequest) {
  const res = await fetch(`${BASE_URL}/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await req.text(),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
