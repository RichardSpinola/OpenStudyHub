"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAuthenticatedUser } from "@/lib/authorization";
import { createDirectRoom, createAudienceRoom } from "@/lib/chat";
import {
  addStudyGroupMember,
  createStudyGroup,
  removeStudyGroupMember,
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

export async function createDirectChatAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const room = createDirectRoom(
    user.id,
    id.parse(formData.get("targetUserId")),
  );
  redirect(`/chat?room=${room.id}`);
}

export async function createGroupAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const group = createStudyGroup(user.id, {
    name: text(formData, "name"),
    description: text(formData, "description"),
    subjectOfferingId: optionalId.parse(formData.get("subjectOfferingId")),
    memberUserIds: formData
      .getAll("memberUserId")
      .map((value) => id.parse(value)),
  });
  redirect(`/chat?group=${group.id}`);
}

export async function createAudienceChatAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const room = createAudienceRoom(user.id, {
    name: text(formData, "name"),
    audienceType: z
      .enum(["instance", "program", "cohort"])
      .parse(formData.get("audienceType")),
    programId: optionalId.parse(formData.get("programId")),
    cohortId: optionalId.parse(formData.get("cohortId")),
  });
  redirect(`/chat?room=${room.id}`);
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
