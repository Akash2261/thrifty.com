import { NextRequest, NextResponse } from "next/server";
import { BASE_URL, BackendAuthError, refreshBackendTokens } from "@/lib/server/backend";
import { clearTokens, getTokens, setTokens } from "@/lib/server/session";

// A single authenticated pass-through to the Fastify backend. The browser only ever talks to
// this same-origin route (never Fastify directly), so an httpOnly session cookie can gate every
// call without the browser needing to see the access token — and this is what lets endpoints that
// require auth, like the receipt image and the CSV export, work as plain <img src>/<a href> URLs.
interface RequestBody {
  body?: BodyInit;
  contentType?: string;
}

async function readOutgoingBody(req: NextRequest): Promise<RequestBody> {
  if (req.method === "GET" || req.method === "HEAD") return {};
  const contentType = req.headers.get("content-type");
  if (!contentType) return {};
  if (contentType.includes("multipart/form-data")) {
    // Re-collecting into a fresh FormData lets fetch() compute its own boundary header, and the
    // File/Blob entries it holds are safe to send twice if a 401 forces a retry after refresh.
    const incoming = await req.formData();
    const outgoing = new FormData();
    for (const [key, value] of incoming.entries()) outgoing.append(key, value);
    return { body: outgoing };
  }
  const text = await req.text();
  return { body: text || undefined, contentType };
}

async function forward(
  req: NextRequest,
  path: string[],
  accessToken: string,
  outgoing: RequestBody,
): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (outgoing.contentType) headers["Content-Type"] = outgoing.contentType;
  return fetch(`${BASE_URL}/${path.join("/")}${req.nextUrl.search}`, {
    method: req.method,
    headers,
    body: outgoing.body,
    cache: "no-store",
  });
}

async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const { accessToken, refreshToken } = await getTokens();
  if (!accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const outgoing = await readOutgoingBody(req);
  let res = await forward(req, path, accessToken, outgoing);

  if (res.status === 401 && refreshToken) {
    try {
      const rotated = await refreshBackendTokens(refreshToken);
      await setTokens(rotated);
      res = await forward(req, path, rotated.accessToken, outgoing);
    } catch (err) {
      if (err instanceof BackendAuthError) {
        await clearTokens();
        return NextResponse.json({ error: "Session expired" }, { status: 401 });
      }
      throw err;
    }
  }

  const buffer = await res.arrayBuffer();
  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  const contentDisposition = res.headers.get("content-disposition");
  if (contentType) headers.set("content-type", contentType);
  if (contentDisposition) headers.set("content-disposition", contentDisposition);
  return new NextResponse(buffer, { status: res.status, headers });
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
