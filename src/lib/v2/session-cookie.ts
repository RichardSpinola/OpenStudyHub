import { cookies, headers } from "next/headers";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    (host.includes(":") &&
      (host.startsWith("fc") ||
        host.startsWith("fd") ||
        /^fe[89ab]/u.test(host)))
  )
    return true;

  const octets = host.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return false;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254)
  );
}

export function secureV2CookieForRequest(
  requestHeaders: Pick<Headers, "get">,
  production: boolean,
): boolean {
  if (!production) return false;

  const origin = requestHeaders.get("origin");
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:") return true;
    if (!isLocalHostname(url.hostname)) return true;

    const requestHosts = [
      requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-host"),
    ];
    if (!requestHosts.includes(url.host)) return true;

    const forwardedProtocols = requestHeaders.get("x-forwarded-proto");
    if (
      forwardedProtocols &&
      forwardedProtocols.split(",").some((value) => value.trim() !== "http")
    )
      return true;

    return false;
  } catch {
    return true;
  }
}

async function cookieOptions() {
  const secure = secureV2CookieForRequest(
    await headers(),
    process.env.NODE_ENV === "production",
  );
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
  };
}

export async function writeV2SessionCookie(
  name: string,
  token: string,
): Promise<void> {
  (await cookies()).set(name, token, {
    ...(await cookieOptions()),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearV2SessionCookie(name: string): Promise<void> {
  (await cookies()).set(name, "", {
    ...(await cookieOptions()),
    maxAge: 0,
  });
}
