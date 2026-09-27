import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { notFound } from "next/navigation";
import { extraAccessible, getExtrasFlags } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import { GlobalWhiteboard } from "@/components/global-whiteboard";

export default function WhiteboardPage() {
  if (!withV2Db((db) => extraAccessible(getExtrasFlags(db), "whiteboard")))
    notFound();
  return (
    <div className="whiteboard-workspace">
      <Link className="whiteboard-exit" href="/extras">
        <UiCopy pt="← Voltar para Extras" en="← Back to Extras" />
      </Link>
      <GlobalWhiteboard />
    </div>
  );
}
