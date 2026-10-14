import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/authorization";
export const dynamic = "force-dynamic";
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuthenticatedUser();
  const query = await searchParams;
  const values = new URLSearchParams({ type: "documents" });
  for (const [key, value] of Object.entries(query))
    if (typeof value === "string" && key !== "type") values.set(key, value);
  if (!values.has("view")) values.set("view", "library");
  redirect(`/library?${values}`);
}
