import { UiCopy } from "@/components/ui-language-provider";
import { notFound } from "next/navigation";
import Link from "next/link";

import { requireAuthenticatedUser } from "@/lib/authorization";
import { canViewUser, listAssignedProfileTags } from "@/lib/collaboration";
import { getProfileAcademicContext, getUserProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ from?: string; room?: string }>;
}) {
  const actor = await requireAuthenticatedUser();
  const raw = (await params).userId;
  if (!/^\d+$/u.test(raw)) notFound();
  const userId = Number(raw);
  if (!canViewUser(actor.id, userId)) notFound();
  const profile = getUserProfile(userId);
  const academic = getProfileAcademicContext(userId);
  const tags = listAssignedProfileTags(actor.id, userId);
  const query = await searchParams;
  const backToChat =
    query.from === "chat" && /^\d+$/u.test(query.room ?? "")
      ? `/chat?room=${query.room}`
      : null;
  return (
    <div className="page-shell profile-page">
      {backToChat ? (
        <Link className="profile-back-link" href={backToChat}>
          <UiCopy pt="← Voltar à conversa" en="← Back to conversation" />
        </Link>
      ) : null}
      <div className="profile-hero">
        {profile.bannerStorageName ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="profile-banner"
            src={`/api/profile-media/${userId}/banner`}
            alt=""
          />
        ) : (
          <div
            className="profile-banner profile-banner-empty"
            aria-hidden="true"
          />
        )}
        <section className="profile-card">
          {profile.avatarStorageName ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="profile-avatar"
              src={`/api/profile-media/${userId}/avatar`}
              alt=""
            />
          ) : (
            <span
              className="profile-avatar profile-avatar-empty"
              aria-hidden="true"
            >
              {profile.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="profile-headline">
            <h1>{profile.displayName}</h1>
            {academic.programName ? (
              <p>
                {academic.programName}
                {academic.cohortName ? ` · ${academic.cohortName}` : ""}
              </p>
            ) : null}
          </div>
          {profile.bio ? <p>{profile.bio}</p> : null}
          {tags.length ? (
            <ul className="profile-tags">
              {tags.map((tag) => (
                <li key={tag.id}>{tag.label}</li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
