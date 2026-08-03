import { NextRequest, NextResponse } from "next/server";

// Renamed from Next.js's old "middleware" file convention (Next 16) — same request-gating role,
// just no `matcher` config export here (disallowed for proxy files), so path-skipping happens
// inline instead.
const ACCESS_COOKIE = "thrifty_at";
const REFRESH_COOKIE = "thrifty_rt";
const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/phone-sign-in"];
const SKIP_PREFIXES = ["/api", "/_next", "/favicon.ico"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const hasSession = Boolean(
    request.cookies.get(ACCESS_COOKIE)?.value || request.cookies.get(REFRESH_COOKIE)?.value,
  );
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
