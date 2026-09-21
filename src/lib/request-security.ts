import { getServerEnvironment } from "@/lib/env";

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const candidate = new URL(origin).origin;
    const configured = new URL(getServerEnvironment().APP_URL).origin;
    const requestOrigin = new URL(request.url).origin;
    return candidate === configured || candidate === requestOrigin;
  } catch {
    return false;
  }
}
