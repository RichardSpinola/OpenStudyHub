import { getServerEnvironment } from "@/lib/env";

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const candidate = new URL(origin);
    const configured = new URL(getServerEnvironment().APP_URL).origin;
    const requestOrigin = new URL(request.url).origin;
    // Behind Docker port mapping request.url is the container address (for example
    // localhost:3000), so the LAN Admin also matches the browser-supplied Host.
    const host = request.headers.get("host");
    return (
      candidate.origin === configured ||
      candidate.origin === requestOrigin ||
      (!!host && candidate.host === host.toLowerCase())
    );
  } catch {
    return false;
  }
}
