// Next's internal Request URL may use its listen hostname behind a local proxy.
// The browser's Host header still names the destination and cannot be overridden
// by a cross-origin browser script. Compare that destination with Origin.
export function sameNoteRequestOrigin(headers: Pick<Headers, "get">): boolean {
  const origin = headers.get("origin"),
    host = headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.origin === origin &&
      parsed.host.toLowerCase() === host.toLowerCase()
    );
  } catch {
    return false;
  }
}
