import { after } from "next/server";
import { enqueueRoomMention } from "@/lib/ai/chat";
import { runAiRequest } from "@/lib/ai/generation";
import { assertToolAvailable } from "@/lib/v2/exam-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/authorization";
import {
  isValidChatAttachmentData,
  saveChatAttachment,
} from "@/lib/chat-attachments";
import {
  chatFileLimitBytes,
  chatImageLimitBytes,
  isChatImageName,
  validChatFilename,
  readChatFormData,
} from "@/lib/chat-upload";
import {
  canAccessChatRoom,
  deleteChatMessage,
  editChatMessage,
  listChatMessages,
  chatWindow,
  sendChatMessage,
} from "@/lib/chat";
import { renderChatMarkdown } from "@/lib/chat-markdown";
import { isSameOriginRequest } from "@/lib/request-security";
import { randomUUID } from "node:crypto";
import { canonicalChatUserId, sendChatMessageOnce } from "@/lib/v2/chat-state";
import { withV2Db } from "@/lib/v2/runtime";

export const dynamic = "force-dynamic";
const id = z.coerce.number().int().positive();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertToolAvailable(session.user.id);
    const roomId = id.parse((await context.params).roomId);
    if (
      request.nextUrl.searchParams.has("sync") ||
      request.nextUrl.searchParams.has("before")
    ) {
      const number = (key: string) =>
        request.nextUrl.searchParams.has(key)
          ? z.coerce
              .number()
              .int()
              .nonnegative()
              .parse(request.nextUrl.searchParams.get(key))
          : undefined;
      const result = chatWindow(session.user.id, roomId, {
        before: number("before"),
        since: number("since"),
      });
      return NextResponse.json(
        {
          ...result,
          messages: result.messages.map((m) => ({
            ...m,
            bodyHtml: renderChatMarkdown(m.bodySource),
          })),
        },
        { headers: { "cache-control": "private, no-store" } },
      );
    }
    const after = z.coerce
      .number()
      .int()
      .min(0)
      .catch(0)
      .parse(request.nextUrl.searchParams.get("after"));
    const messages = listChatMessages(session.user.id, roomId, after).map(
      (message) => ({
        ...message,
        bodyHtml: renderChatMarkdown(message.bodySource),
      }),
    );
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403 });
  }
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertToolAvailable(session.user.id);
    const roomId = id.parse((await context.params).roomId);
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      if (!canAccessChatRoom(session.user.id, roomId))
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const form = await readChatFormData(request);
      const image = form.get("file") ?? form.get("image");
      const body = z
        .string()
        .trim()
        .max(10_000)
        .parse(form.get("body") ?? "");
      const replyRaw = form.get("replyToMessageId");
      const replyToMessageId =
        typeof replyRaw === "string" && replyRaw ? id.parse(replyRaw) : null;
      const clientMessageId = z
        .string()
        .uuid()
        .parse(form.get("clientMessageId") || randomUUID());
      if (
        !(image instanceof File) ||
        !validChatFilename(image.name) ||
        !image.size ||
        image.size >
          (isChatImageName(image.name)
            ? chatImageLimitBytes
            : chatFileLimitBytes) ||
        form.getAll("file").length > 1 ||
        form.getAll("image").length > 1 ||
        (form.has("file") && form.has("image"))
      ) {
        return NextResponse.json(
          { error: "invalid-attachment" },
          { status: 400 },
        );
      }
      const imageData = Buffer.from(await image.arrayBuffer());
      if (
        isChatImageName(image.name) &&
        !(await isValidChatAttachmentData(imageData))
      ) {
        return NextResponse.json(
          { error: "invalid-attachment" },
          { status: 400 },
        );
      }
      const outcome =
        process.env.OPENSTUDYHUB_V2_ENABLED === "1"
          ? sendChatMessageOnce(
              withV2Db((db) => canonicalChatUserId(db, session.user.id)),
              session.user.id,
              roomId,
              clientMessageId,
              body,
              replyToMessageId,
              true,
            )
          : {
              messageId: sendChatMessage(session.user.id, roomId, {
                body,
                hasAttachment: true,
                replyToMessageId,
              }).id,
              duplicate: false,
            };
      const message = listChatMessages(
        session.user.id,
        roomId,
        outcome.messageId - 1,
      ).find((item) => item.id === outcome.messageId)!;
      if (outcome.duplicate)
        return NextResponse.json({
          message: {
            ...message,
            bodyHtml: renderChatMarkdown(message.bodySource),
          },
        });
      try {
        await saveChatAttachment(
          session.user.id,
          roomId,
          message.id,
          imageData,
          { filename: image.name },
        );
        const saved = listChatMessages(session.user.id, roomId, 0, undefined, {
          ids: [message.id],
        })[0];
        return NextResponse.json({
          message: { ...saved, bodyHtml: renderChatMarkdown(saved.bodySource) },
        });
      } catch {
        if (!body) {
          deleteChatMessage(session.user.id, message.id);
          return NextResponse.json(
            { error: "attachment-storage-failed" },
            { status: 500 },
          );
        }
        return NextResponse.json({
          message: {
            ...message,
            bodyHtml: renderChatMarkdown(message.bodySource),
          },
          attachmentWarning: true,
        });
      }
    }

    const input = z
      .object({
        body: z.string().trim().max(10_000),
        clientMessageId: z.string().uuid().optional(),
        replyToMessageId: z.number().int().positive().nullable().optional(),
      })
      .refine((value) => value.body.length > 0, {
        message: "Message is required.",
      })
      .parse(await request.json());
    const message =
      process.env.OPENSTUDYHUB_V2_ENABLED === "1"
        ? (() => {
            const outcome = sendChatMessageOnce(
              withV2Db((db) => canonicalChatUserId(db, session.user.id)),
              session.user.id,
              roomId,
              input.clientMessageId || randomUUID(),
              input.body,
              input.replyToMessageId ?? null,
            );
            return listChatMessages(
              session.user.id,
              roomId,
              outcome.messageId - 1,
            ).find((item) => item.id === outcome.messageId)!;
          })()
        : sendChatMessage(session.user.id, roomId, input);
    let aiWarning: string | undefined;
    try {
      const ai = enqueueRoomMention(session.user.id, roomId, message.id);
      if (ai)
        after(async () => {
          await runAiRequest(ai.requestId);
        });
    } catch {
      aiWarning =
        "Mensagem enviada; a IA não pôde responder agora. Confira a fila, cota ou permissão do grupo. / Message sent; AI cannot reply now. Check the queue, quota or group permission.";
    }
    return NextResponse.json({
      message: { ...message, bodyHtml: renderChatMarkdown(message.bodySource) },
      ...(aiWarning ? { aiWarning } : {}),
    });
  } catch {
    return NextResponse.json({ error: "invalid-message" }, { status: 400 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  if (!isSameOriginRequest(request))
    return new NextResponse(null, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  try {
    assertToolAvailable(session.user.id);
    const roomId = id.parse((await context.params).roomId);
    const input = z
      .object({
        messageId: z.number().int().positive(),
        body: z.string().trim().min(1).max(10_000),
      })
      .parse(await request.json());
    if (
      !listChatMessages(session.user.id, roomId, 0, undefined, {
        ids: [input.messageId],
      }).some(({ id }) => id === input.messageId)
    ) {
      throw new Error("Message not found.");
    }
    editChatMessage(session.user.id, input.messageId, input.body);
    const message = listChatMessages(session.user.id, roomId, 0, undefined, {
      ids: [input.messageId],
    }).find(({ id: messageId }) => messageId === input.messageId);
    if (!message) throw new Error("Message not found.");
    return NextResponse.json({
      message: { ...message, bodyHtml: renderChatMarkdown(message.bodySource) },
    });
  } catch {
    return NextResponse.json({ error: "invalid-message" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  if (!isSameOriginRequest(request))
    return new NextResponse(null, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  try {
    assertToolAvailable(session.user.id);
    const roomId = id.parse((await context.params).roomId);
    const input = z
      .object({ messageId: z.number().int().positive() })
      .parse(await request.json());
    if (
      !listChatMessages(session.user.id, roomId, 0, undefined, {
        ids: [input.messageId],
      }).some(({ id }) => id === input.messageId)
    ) {
      throw new Error("Message not found.");
    }
    deleteChatMessage(session.user.id, input.messageId);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "invalid-message" }, { status: 400 });
  }
}
