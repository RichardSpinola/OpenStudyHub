import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getExtrasFlags } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import "./extras.css";

export default async function ExtrasLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAuthenticatedUser();
  if (
    process.env.OPENSTUDYHUB_V2_ENABLED !== "1" ||
    !withV2Db((db) => getExtrasFlags(db).extras)
  )
    notFound();
  return <main className="extras-shell">{children}</main>;
}
