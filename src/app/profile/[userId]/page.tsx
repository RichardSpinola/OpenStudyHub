import { notFound } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/authorization";
import { canViewUser, listAssignedProfileTags } from "@/lib/collaboration";
import { getProfileAcademicContext, getUserProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const actor = await requireAuthenticatedUser();
  const raw = (await params).userId;
  if (!/^\d+$/u.test(raw)) notFound();
  const userId = Number(raw);
  if (!canViewUser(actor.id, userId)) notFound();
  const profile = getUserProfile(userId);
  const academic = getProfileAcademicContext(userId);
  const tags = listAssignedProfileTags(actor.id, userId);
  return (
    <div className="page-shell profile-page">
      {profile.bannerStorageName ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="profile-banner"
          src={`/api/profile-media/${userId}/banner`}
          alt=""
        />
      ) : null}
      <section className="profile-card">
        {profile.avatarStorageName ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="profile-avatar"
            src={`/api/profile-media/${userId}/avatar`}
            alt=""
          />
        ) : null}
        <h1>{profile.displayName}</h1>
        {academic.programName ? (
          <p>
            {academic.programName}
            {academic.cohortName ? ` · ${academic.cohortName}` : ""}
          </p>
        ) : null}
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
  );
}
