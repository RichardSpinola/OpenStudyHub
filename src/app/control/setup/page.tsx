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
    <ConsoleShell
      title="Configuração inicial"
      kicker="OpenStudyHub · preparar instância"
      error={q.error}
    >
      <p>
        Configure a base da instituição. Você pode voltar sem perder o que já
        preencheu.
      </p>
      <SetupWizard />
    </ConsoleShell>
  );
}
