"use client";
import { UiCopy } from "@/components/ui-language-provider";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChatContext } from "@/components/chat-context-layout";

type Participant = {
  id: number;
  displayName: string;
  hasAvatar: boolean;
};

export function ChatParticipantPanel({
  participants,
  roomId,
}: {
  participants: Participant[];
  roomId: number;
}) {
  const [onlineIds, setOnlineIds] = useState<Set<number> | null>(null);
  const { open } = useChatContext();

  useEffect(() => {
    if (!open) return;
    let active = true;
    const refresh = async () => {
      try {
        const chunks: number[][] = [];
        for (let index = 0; index < participants.length; index += 50) {
          chunks.push(
            participants.slice(index, index + 50).map(({ id }) => id),
          );
        }
        const batches = await Promise.all(
          chunks.map(async (ids) => {
            const response = await fetch(`/api/presence?ids=${ids.join(",")}`, {
              cache: "no-store",
            });
            if (!response.ok) throw new Error("presença indisponível");
            return (await response.json()) as {
              users: Array<{ id: number; online: boolean }>;
            };
          }),
        );
        if (active) {
          setOnlineIds(
            new Set(
              batches.flatMap(({ users }) =>
                users.filter(({ online }) => online).map(({ id }) => id),
              ),
            ),
          );
        }
      } catch {
        if (active) setOnlineIds(null);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [participants, open]);

  const online = onlineIds
    ? participants.filter(({ id }) => onlineIds.has(id))
    : [];
  const offline = onlineIds
    ? participants.filter(({ id }) => !onlineIds.has(id))
    : participants;
  const sections = onlineIds
    ? [
        { label: "Online", people: online, online: true },
        { label: "Offline", people: offline, online: false },
      ]
    : [{ label: "Pessoas", people: offline, online: false }];

  return (
    <div className="chat-participants">
      <h3>
        <UiCopy pt="Pessoas na conversa ·" en="People in this conversation ·" />{" "}
        {participants.length}
      </h3>
      {sections.map(({ label, people, online: isOnline }) =>
        people.length ? (
          <section key={label} aria-label={`${label}: ${people.length}`}>
            <h4>
              {label} — {people.length}
            </h4>
            <ul>
              {people.map((person) => (
                <li key={person.id}>
                  <Link href={`/profile/${person.id}?from=chat&room=${roomId}`}>
                    <span className="chat-participant-avatar">
                      {person.hasAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/profile-media/${person.id}/avatar`}
                          alt=""
                        />
                      ) : (
                        person.displayName.slice(0, 1).toUpperCase()
                      )}
                      {onlineIds ? (
                        <i
                          data-online={isOnline}
                          aria-label={isOnline ? "Online" : "Offline"}
                        />
                      ) : null}
                    </span>
                    <span>{person.displayName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
