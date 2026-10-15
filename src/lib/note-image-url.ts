export const noteImageMaxBytes = 5 * 1024 * 1024;
export function noteImageId(url: string): string | null {
  return (
    /^\/api\/note-images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
      url,
    )?.[1] ?? null
  );
}
export function validNoteImageUrl(url: string): boolean {
  if (!url || noteImageId(url)) return true;
  try {
    return ["https:", "http:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
