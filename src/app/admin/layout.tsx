import type { ReactNode } from "react";

import { requireAcademicAdministrator } from "@/lib/authorization";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAcademicAdministrator();
  return children;
}
