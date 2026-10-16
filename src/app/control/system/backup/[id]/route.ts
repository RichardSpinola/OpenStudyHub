import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import { backupDirectory } from "@/lib/v2/manual-backup";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const allowed = await withV2DbAsync(async (db) => {
    const admin = await currentAdminV2(db);
    return !!admin && !admin.mustChangePassword;
  });
  if (!allowed) return new Response("Não autorizado.", { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/.test(id))
    return new Response("Não encontrado.", { status: 404 });
  const encrypted = existsSync(join(backupDirectory(), `${id}.oshbackup`));
  const extension = encrypted ? "oshbackup" : "zip";
  const path = join(backupDirectory(), `${id}.${extension}`);
  if (!existsSync(path))
    return new Response("Não encontrado.", { status: 404 });
  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": encrypted
        ? "application/octet-stream"
        : "application/zip",
      "Content-Disposition": `attachment; filename="openstudyhub-backup-${id}.${extension}"`,
      "Content-Length": String(statSync(path).size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
