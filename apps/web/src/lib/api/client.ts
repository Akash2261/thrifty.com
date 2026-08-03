export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractErrorMessage(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const firstField = Object.values(err as Record<string, unknown>)[0];
      if (Array.isArray(firstField) && typeof firstField[0] === "string") return firstField[0];
    }
  }
  return "Something went wrong";
}

async function parseJsonOrEmpty(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// Same contract as apps/mobile/src/api/client.ts: backend errors are always `{ error: string }`
// (or `{ error: Record<string,string[]> }` for Zod field errors), surfaced as ApiError.status.
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!isFormData && options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, { ...options, headers });
  const body = await parseJsonOrEmpty(res);

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = "/sign-in";
    }
    throw new ApiError(res.status, extractErrorMessage(body));
  }

  return body as T;
}

// Every authenticated call goes through our own same-origin proxy, never the Fastify backend
// directly — the httpOnly session cookie is what authorizes it server-side (see
// app/api/proxy/[...path]/route.ts).
export function authorizedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(`/api/proxy${path}`, options);
}
