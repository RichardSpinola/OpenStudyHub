import { redirect } from "next/navigation";
import { withV2DbAsync } from "@/lib/v2/runtime";
import { isSetupPending } from "@/lib/v2/auth";
import { ConsoleShell } from "../ui";
import { SetupWizard } from "./setup-wizard";
export default async function Setup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await withV2DbAsync(async (db) => isSetupPending(db))))
    redirect("/control/login");
  const q = await searchParams;
  return (
    <ConsoleShell title="OpenStudyHub" kicker="SETUP" error={q.error}>
      <SetupWizard />
    </ConsoleShell>
  );
}
