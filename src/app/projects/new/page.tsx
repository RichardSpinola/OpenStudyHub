import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/authorization";
export const dynamic = "force-dynamic";
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuthenticatedUser();
  const params = await searchParams;
  const query = new URLSearchParams({
    type: "projects",
    view: "create",
    from: "projects",
  });
  for (const [key, value] of Object.entries(params))
    if (typeof value === "string" && key !== "type" && key !== "view")
      query.set(key, value);
  redirect(`/library?${query}`);
}
