import { requireToolUser } from "@/lib/authorization";
import { extraAccessible, getExtrasFlags } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import { notFound } from "next/navigation";
import { ExtraWorkspace } from "@/components/extra-workspace";
import { FocusControls } from "@/components/focus-tools";
export default async function FocusPage() {
  await requireToolUser();
  if (!extraAccessible(withV2Db(getExtrasFlags), "focus")) notFound();
  return (
    <ExtraWorkspace title="Foco" titleEn="Focus">
      <FocusControls />
    </ExtraWorkspace>
  );
}
