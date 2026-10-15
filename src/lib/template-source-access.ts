import { getDatabase, type DatabaseConnection } from "./db/client";
import { getUserDocumentTemplate } from "./document-templates";
import { getDriveAccessPolicy } from "./drive-access-policy";
import { grantDriveFileWriter, exportGoogleDocument } from "./google/drive";
import { getGoogleAccessToken, type GoogleFetch } from "./google/oauth";
/** The recipient comes from this user's authenticated Google identity, never a submitted email. */
export async function openOwnedTemplateSource(
  userId: number,
  templateId: number,
  options: { connection?: DatabaseConnection; fetchImpl?: GoogleFetch } = {},
) {
  const connection = options.connection ?? getDatabase(),
    template = getUserDocumentTemplate(userId, templateId, connection),
    storageUserId = template.storageUserId ?? userId;
  if (getDriveAccessPolicy(connection) === "app-only")
    return { kind: "app-only" as const, template };
  if (storageUserId !== userId) {
    const fetchImpl = options.fetchImpl ?? fetch;
    let email: string;
    if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
      const { withV2DbAsync } = await import("./v2/runtime-database");
      const { verifiedGoogleEmailV2 } = await import("./v2/google-oauth");
      email = await withV2DbAsync(async (db) => {
        const link = db
          .prepare(
            "SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?",
          )
          .get(userId) as { id: number } | undefined;
        if (!link) throw new Error("Conta Google sem vínculo.");
        return verifiedGoogleEmailV2(db, link.id, { fetchImpl });
      });
    } else {
      const token = await getGoogleAccessToken(userId, {
        connection,
        fetchImpl,
      });
      const response = await fetchImpl(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok)
        throw new Error("Confirme sua conexão Google antes de abrir a base.");
      const info = (await response.json()) as {
        sub?: unknown;
        email?: unknown;
        email_verified?: unknown;
      };
      const known = connection.sqlite
        .prepare(
          "SELECT google_subject subject FROM google_connections WHERE user_id=? AND status='connected'",
        )
        .get(userId) as { subject: string } | undefined;
      if (
        !known ||
        info.sub !== known.subject ||
        info.email_verified !== true ||
        typeof info.email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)
      )
        throw new Error("Não foi possível confirmar sua identidade Google.");
      email = info.email;
    }
    await grantDriveFileWriter(storageUserId, template.sourceFileId, email, {
      connection,
      fetchImpl,
    });
  }
  return { kind: "direct" as const, template };
}
export async function downloadOwnedTemplateSource(
  userId: number,
  templateId: number,
  options: { connection?: DatabaseConnection; fetchImpl?: GoogleFetch } = {},
) {
  const connection = options.connection ?? getDatabase(),
    template = getUserDocumentTemplate(userId, templateId, connection);
  return {
    name: template.name,
    bytes: await exportGoogleDocument(
      template.storageUserId ?? userId,
      template.sourceFileId,
      "application/pdf",
      options,
    ),
  };
}
