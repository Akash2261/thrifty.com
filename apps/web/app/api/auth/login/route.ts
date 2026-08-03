import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/server/backend";
import { setTokens } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await req.text(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return NextResponse.json({ user: data.user });
}
