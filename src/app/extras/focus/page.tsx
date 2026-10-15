import { requireToolUser } from "@/lib/authorization";
import { extraAccessible, getExtrasFlags } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import { notFound } from "next/navigation";
import Link from "next/link";
import { UiCopy } from "@/components/ui-language-provider";
import { FocusControls } from "@/components/focus-tools";
export default async function FocusPage() {
  await requireToolUser();
  if (!extraAccessible(withV2Db(getExtrasFlags), "focus")) notFound();
  return (
    <>
      <header className="extras-header">
        <Link href="/extras">← Extras</Link>
        <h1>
          <UiCopy pt="Foco" en="Focus" />
        </h1>
        <p>
          <UiCopy
            pt="Um tempo para estudar, outro para respirar. O Pomodoro acompanha você nas outras páginas."
            en="Time to study and time to rest. Pomodoro follows you across pages."
          />
        </p>
      </header>
      <FocusControls />
    </>
  );
}
