import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import { visiblePrograms } from "@/lib/v2/control";
export async function V2ManagementLink() {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1") return null;
  let allowed = false;
  try {
    allowed = !!(await withV2DbAsync(async (db) => {
      const user = await currentUserV2(db);
      return user && visiblePrograms(db, user).length > 0;
    }));
  } catch {
    allowed = false;
  }
  return allowed ? (
    <Link href="/gestao">
      <UiCopy pt="Gestão" en="Management" />
    </Link>
  ) : null;
}
