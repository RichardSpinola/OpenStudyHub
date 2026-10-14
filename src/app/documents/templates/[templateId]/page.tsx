import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/authorization";
export const dynamic = "force-dynamic";
export default async function TemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAuthenticatedUser();
  const id = (await params).templateId;
  const query = await searchParams;
  const values = new URLSearchParams({
    type: "documents",
    view: "template",
    templateId: id,
  });
  if (query.status) values.set("status", query.status);
  redirect(`/library?${values}`);
}
