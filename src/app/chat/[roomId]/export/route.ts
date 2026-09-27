import { Readable } from "node:stream";
import yazl from "yazl";
import { getCurrentSession } from "@/lib/authorization";
import { canAccessChatRoom, listChatMessages } from "@/lib/chat";
import { readChatAttachment } from "@/lib/chat-attachments";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return new Response(null, { status: 401 });
  const roomId = Number((await context.params).roomId);
  if (
    !Number.isSafeInteger(roomId) ||
    roomId < 1 ||
    !canAccessChatRoom(session.user.id, roomId)
  )
    return new Response(null, { status: 403 });
  const messages: ReturnType<typeof listChatMessages> = [];
  let cursor = 0;
  while (messages.length < 10000) {
    const page = listChatMessages(session.user.id, roomId, cursor);
    if (!page.length) break;
    messages.push(...page);
    cursor = page.at(-1)!.id;
    if (page.length < 200) break;
  }
  const archive = new yazl.ZipFile();
  const omittedAttachments: number[] = [];
  let mediaBytes = 0;
  for (const message of messages) {
    for (const attachmentId of message.attachmentIds) {
      const image = await readChatAttachment(session.user.id, attachmentId);
      if (!image || mediaBytes + image.data.length > 50 * 1024 * 1024) {
        omittedAttachments.push(attachmentId);
        continue;
      }
      mediaBytes += image.data.length;
      const ext =
        image.mimeType === "image/png"
          ? "png"
          : image.mimeType === "image/webp"
            ? "webp"
            : "jpg";
      archive.addBuffer(image.data, `media/${attachmentId}.${ext}`);
    }
  }
  archive.addBuffer(
    Buffer.from(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          roomId,
          messageLimitReached: messages.length >= 10000,
          omittedAttachments,
          messages,
        },
        null,
        2,
      ),
    ),
    "messages.json",
  );
  archive.addBuffer(
    Buffer.from(
      "Exportação pessoal do OpenStudyHub. Imagens estão em media/. Anexos omitidos excederam 50 MiB ou ficaram indisponíveis.\n",
    ),
    "LEIA-ME.txt",
  );
  archive.end();
  return new Response(
    Readable.toWeb(
      archive.outputStream as unknown as Readable,
    ) as ReadableStream<Uint8Array>,
    {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="openstudyhub-chat-${roomId}.zip"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
