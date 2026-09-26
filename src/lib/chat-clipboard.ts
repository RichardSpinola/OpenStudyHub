export const chatPasteImageTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const chatPasteImageLimit = 5 * 1024 * 1024;

type ClipboardEntry = Pick<DataTransferItem, "kind" | "type" | "getAsFile">;

export function pastedChatImage(items: ClipboardEntry[]): {
  file: File | null;
  hasText: boolean;
  invalidImage: boolean;
} {
  const hasText = items.some(
    (entry) => entry.kind === "string" && entry.type.startsWith("text/"),
  );
  const image = items.find(
    (entry) => entry.kind === "file" && entry.type.startsWith("image/"),
  );
  if (!image) return { file: null, hasText, invalidImage: false };
  const file = image.getAsFile();
  if (
    !file ||
    !chatPasteImageTypes.includes(
      file.type as (typeof chatPasteImageTypes)[number],
    ) ||
    file.size > chatPasteImageLimit ||
    file.size === 0
  )
    return { file: null, hasText, invalidImage: true };
  return { file, hasText, invalidImage: false };
}
