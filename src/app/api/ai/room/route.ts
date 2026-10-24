import { aiUser, aiHeaders, aiError } from "@/lib/ai/http";
import { getDatabase } from "@/lib/db/client";
import { canAccessChatRoom } from "@/lib/chat";
import { getConversation } from "@/lib/ai/conversations";
import { readAiConfig } from "@/lib/ai/config";
import { setRoomAiPermission } from "@/lib/ai/chat";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await aiUser(request),
      roomId = Number(new URL(request.url).searchParams.get("room"));
    const db = getDatabase();
    if (
      !Number.isSafeInteger(roomId) ||
      !canAccessChatRoom(user.id, roomId, db)
    )
      throw new Error();
    const config = readAiConfig().config;
    const group = db.sqlite
      .prepare(
        "SELECT r.group_id,m.member_role FROM chat_rooms r LEFT JOIN study_group_members m ON m.group_id=r.group_id AND m.user_id=? WHERE r.id=?",
      )
      .get(user.id, roomId) as {
      group_id: number | null;
      member_role: string | null;
    };
    const permission = !!db.sqlite
      .prepare(
        "SELECT 1 FROM ai_room_permissions WHERE room_id=? AND enabled=1",
      )
      .get(roomId);
    const conversation = db.sqlite
      .prepare("SELECT id FROM ai_conversations WHERE room_id=?")
      .get(roomId) as { id: string } | undefined;
    let messages: unknown[] = [];
    if (conversation) {
      getConversation(user.id, conversation.id);
      messages = db.sqlite
        .prepare(
          "SELECT m.id,m.content,m.status,m.created_at,r.human_message_id FROM ai_messages m JOIN ai_requests r ON r.assistant_message_id=m.id WHERE m.conversation_id=? ORDER BY m.created_at DESC LIMIT 100",
        )
        .all(conversation.id);
    }
    return Response.json(
      {
        enabled: config.enabled,
        groupEnabled: config.groups,
        permission: group.group_id ? permission : config.global,
        canConfigure: group.member_role === "owner",
        messages,
      },
      { headers: aiHeaders },
    );
  } catch (error) {
    return aiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await aiUser(request, true),
      input = await request.json();
    if (
      !Number.isSafeInteger(input.roomId) ||
      typeof input.enabled !== "boolean"
    )
      throw new Error();
    setRoomAiPermission(user.id, input.roomId, input.enabled);
    return Response.json({ ok: true }, { headers: aiHeaders });
  } catch (error) {
    return aiError(error);
  }
}
