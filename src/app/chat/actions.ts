"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/authorization";
import {
  createDirectRoom,
  createAudienceRoom,
  canAccessChatRoom,
} from "@/lib/chat";
import {
  changePersonalRoomState,
  saveChatWallpaper,
  saveChatWallpaperImage,
} from "@/lib/v2/chat-state";
import { detectHomeImage } from "@/lib/home-background";
import {
  chatRoomAvatarLimitBytes,
  saveChatRoomAvatar,
} from "@/lib/v2/chat-room-avatar";
import { getDatabase } from "@/lib/db/client";
import {
  addStudyGroupMember,
  createStudyGroup,
  removeStudyGroupMember,
  leaveStudyGroup,
  closeStudyGroup,
} from "@/lib/collaboration";

const id = z.coerce.number().int().positive();
const optionalId = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().int().positive().nullable(),
);
const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

async function selectedRoomAvatar(formData: FormData) {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > chatRoomAvatarLimitBytes)
    throw new Error("A imagem da conversa deve ter até 5 MiB.");
  const image = Buffer.from(await file.arrayBuffer());
  const format = await detectHomeImage(image);
  if (!format || file.type !== format.mimeType)
    throw new Error("Use PNG, JPEG ou WebP para a imagem da conversa.");
  return { image, mimeType: format.mimeType };
}

export async function createDirectChatAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const room = createDirectRoom(
    user.id,
    id.parse(formData.get("targetUserId")),
  );
  changePersonalRoomState(user.id, room.id, "restore");
  redirect(`/chat?room=${room.id}`);
}

export async function createGroupAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  let avatar: Awaited<ReturnType<typeof selectedRoomAvatar>>;
  try {
    avatar = await selectedRoomAvatar(formData);
  } catch {
    redirect("/chat?avatar=error");
  }
  const group = createStudyGroup(user.id, {
    name: text(formData, "name"),
    description: text(formData, "description"),
    subjectOfferingId: optionalId.parse(formData.get("subjectOfferingId")),
    memberUserIds: formData
      .getAll("memberUserId")
      .map((value) => id.parse(value)),
  });
  if (avatar) {
    const room = getDatabase()
      .sqlite.prepare("SELECT id FROM chat_rooms WHERE group_id=?")
      .get(group.id) as { id: number };
    try {
      saveChatRoomAvatar(user.id, room.id, avatar.image, avatar.mimeType);
    } catch {
      redirect(`/chat?group=${group.id}&avatar=error`);
    }
  }
  redirect(`/chat?group=${group.id}`);
}

export async function createAudienceChatAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  let avatar: Awaited<ReturnType<typeof selectedRoomAvatar>>;
  try {
    avatar = await selectedRoomAvatar(formData);
  } catch {
    redirect("/chat?avatar=error");
  }
  const room = createAudienceRoom(user.id, {
    name: text(formData, "name"),
    audienceType: z
      .enum(["instance", "program", "cohort"])
      .parse(formData.get("audienceType")),
    programId: optionalId.parse(formData.get("programId")),
    cohortId: optionalId.parse(formData.get("cohortId")),
  });
  if (avatar)
    try {
      saveChatRoomAvatar(user.id, room.id, avatar.image, avatar.mimeType);
    } catch {
      redirect(`/chat?room=${room.id}&avatar=error`);
    }
  redirect(`/chat?room=${room.id}`);
}

export async function chatRoomAvatarAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const roomId = id.parse(formData.get("roomId"));
  let avatar: Awaited<ReturnType<typeof selectedRoomAvatar>>;
  try {
    avatar = await selectedRoomAvatar(formData);
  } catch {
    redirect(`/chat?room=${roomId}&avatar=error`);
  }
  if (!avatar) redirect(`/chat?room=${roomId}&avatar=error`);
  try {
    saveChatRoomAvatar(user.id, roomId, avatar.image, avatar.mimeType);
  } catch {
    redirect(`/chat?room=${roomId}&avatar=error`);
  }
  redirect(`/chat?room=${roomId}&avatar=saved`);
}

export async function addGroupMemberAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  addStudyGroupMember(
    user.id,
    id.parse(formData.get("groupId")),
    id.parse(formData.get("targetUserId")),
  );
  redirect(`/chat?room=${id.parse(formData.get("roomId"))}`);
}

export async function removeGroupMemberAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  removeStudyGroupMember(
    user.id,
    id.parse(formData.get("groupId")),
    id.parse(formData.get("targetUserId")),
  );
  redirect(`/chat?room=${id.parse(formData.get("roomId"))}`);
}

export async function personalChatAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const roomId = id.parse(formData.get("roomId"));
  const action = z
    .enum(["archive", "restore", "close"])
    .parse(formData.get("intent"));
  if (action === "close") {
    const room = getDatabase()
      .sqlite.prepare("SELECT kind FROM chat_rooms WHERE id=?")
      .get(roomId) as { kind: string } | undefined;
    if (room?.kind !== "direct")
      throw new Error("Fechar é exclusivo de conversas diretas.");
  }
  changePersonalRoomState(user.id, roomId, action);
  redirect(
    action === "archive" || action === "close"
      ? "/chat"
      : `/chat?room=${roomId}`,
  );
}

export async function chatWallpaperAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  saveChatWallpaper(user.id, formData.get("preset"));
  redirect(`/chat?room=${id.parse(formData.get("roomId"))}`);
}

export async function chatWallpaperUploadAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const roomId = id.parse(formData.get("roomId"));
  const file = formData.get("image");
  if (!(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024)
    redirect(`/chat?room=${roomId}&wallpaper=error`);
  const data = Buffer.from(await file.arrayBuffer());
  const format = await detectHomeImage(data);
  if (!format || file.type !== format.mimeType)
    redirect(`/chat?room=${roomId}&wallpaper=error`);
  saveChatWallpaperImage(user.id, data, format.mimeType);
  redirect(`/chat?room=${roomId}&wallpaper=saved`);
}

export async function leaveGroupAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const groupId = id.parse(formData.get("groupId"));
  const roomId = id.parse(formData.get("roomId"));
  if (!canAccessChatRoom(user.id, roomId)) throw new Error("Sem acesso.");
  leaveStudyGroup(user.id, groupId);
  redirect("/chat");
}

export async function closeGroupAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const groupId = id.parse(formData.get("groupId"));
  const roomId = id.parse(formData.get("roomId"));
  if (!canAccessChatRoom(user.id, roomId)) throw new Error("Sem acesso.");
  closeStudyGroup(user.id, groupId);
  redirect("/chat");
}
