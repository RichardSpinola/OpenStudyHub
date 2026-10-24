import { aiUser, aiHeaders, aiError } from "@/lib/ai/http";
import { getDatabase } from "@/lib/db/client";
import {
  listConversations,
  createConversation,
  getConversation,
  messagesForConversation,
  conversationSources,
  renameConversation,
  deleteConversation,
  shareConversation,
  setConversationModel,
} from "@/lib/ai/conversations";
import { repairExpired } from "@/lib/ai/generation";
import { readAiConfig } from "@/lib/ai/config";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await aiUser(request),
      url = new URL(request.url),
      id = url.searchParams.get("id");
    const connection = getDatabase();
    repairExpired(connection);
    if (id) {
      const conversation = getConversation(user.id, id);
      const active = connection.sqlite
        .prepare(
          "SELECT id,status,user_id FROM ai_requests WHERE conversation_id=? AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1",
        )
        .get(id);
      return Response.json(
        {
          conversation,
          messages: messagesForConversation(user.id, id),
          sources: conversationSources(id, connection).map((s, index) => ({
            id: s.id,
            label: `S${index + 1}`,
            title: s.title,
            attachment: !!s.asset_key,
            messageId: s.message_id,
          })),
          active,
        },
        { headers: aiHeaders },
      );
    }
    const config = readAiConfig().config;
    const groups = connection.sqlite
      .prepare(
        "SELECT g.id,g.name FROM study_groups g JOIN study_group_members m ON m.group_id=g.id WHERE m.user_id=? AND g.archived_at IS NULL ORDER BY g.name",
      )
      .all(user.id);
    return Response.json(
      {
        conversations: listConversations(
          user.id,
          (url.searchParams.get("q") ?? "").slice(0, 100),
        ),
        groups,
        enabled: config.enabled,
        allowGroups: config.groups,
        attachments: config.attachments,
        sources: config.sources,
        vision: config.vision,
        models: config.models,
        defaultModel: config.defaultModel,
        visionModels: config.vision ? config.visionModels : [],
      },
      { headers: aiHeaders },
    );
  } catch (error) {
    return aiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await aiUser(request, true);
    if (Number(request.headers.get("content-length")) > 8192) throw new Error();
    const input = await request.json();
    if (input.action === "create") {
      if (!readAiConfig().config.enabled)
        throw new Error("IA desativada / AI disabled");
      return Response.json(
        { conversation: createConversation(user.id) },
        { headers: aiHeaders },
      );
    }
    if (typeof input.id !== "string" || input.id.length > 100)
      throw new Error();
    if (input.action === "rename" && typeof input.title === "string")
      renameConversation(user.id, input.id, input.title);
    else if (input.action === "model" && typeof input.model === "string")
      return Response.json(
        {
          conversation: setConversationModel(
            user.id,
            input.id,
            input.model.slice(0, 200),
          ),
        },
        { headers: aiHeaders },
      );
    else if (input.action === "delete")
      await deleteConversation(user.id, input.id);
    else if (input.action === "share" && Number.isSafeInteger(input.groupId))
      return Response.json(
        {
          conversation: shareConversation(
            user.id,
            input.id,
            input.groupId,
            input.confirmed === true,
          ),
        },
        { headers: aiHeaders },
      );
    else throw new Error();
    return Response.json({ ok: true }, { headers: aiHeaders });
  } catch (error) {
    return aiError(error);
  }
}
