# Update without losing your data

## Before changing versions

1. Read the target release notes and confirm its image is actually published.
2. Create and download a backup in Admin → System → Backup. Keep the recovery key separately, outside the server.
3. For a critical update, stop all writers and take an external copy of the full data volume and private configuration as well. The image reference and encryption key belong to the recovery plan.
4. Preserve the Compose project name and volume. Update all application service images together; leave the proxy configuration consistent.
5. Run migrations, start services and check App health, Admin login, realtime and a representative user workflow.

The first-install script is **not an updater**. It refuses an existing target. A normal update does not erase projects, document templates, notes or Drive connections. A library reset performed on one test instance is not part of the upgrade procedure.

## V2 → current version

The two-database architecture remains. New migrations extend the main and canonical databases; existing migration files must not be edited. Names such as `v2.db`, `v2-migrations` and `OPENSTUDYHUB_V2_*` remain compatible technical identifiers, not a sign of an outdated interface.

Keep local assets, private configuration and `GOOGLE_TOKEN_ENCRYPTION_KEY`. Do not recreate the central Drive merely because the application version changed. Google access can require reconnection after a sanitized restore, but not simply after every update.

## Recovery after failure

Do not start older code against a newer migrated schema. Stop App, Admin, realtime and any backup worker; restore the matching pre-update data copy and matching image/configuration together. Check integrity and health before reopening access. If migration failed, investigate it instead of deleting the database or forcing application startup.

[The recovery guide](operations/manual-backup-restore.md) covers encrypted packages, validation-only mode and offline restore. Remote Drive content is not copied into local backups. Never run `docker compose down -v` as an update step.

## Updating to 3.2.0

3.2.0 adds `drizzle/0024_ai_conversation_model.sql`, two nullable columns that record the model of each AI conversation and reply. Existing rows are not rewritten. A 3.1.0 AI configuration with one model keeps working and appears as a one-model list; open **Admin → AI assistant** to allow more models. No new environment variable is required. To roll back, restore the pre-update data copy together with the 3.1.0 image.

## Updating to 3.1.0

3.1.0 adds one main-database migration (`drizzle/0023_local_ai.sql`, local AI tables) and one canonical migration (`v2-migrations/0032_admin_mfa.sql`, administrator two-step verification). They only create new tables; existing rows are not rewritten. The migration service applies them in order.

- Keep `GOOGLE_TOKEN_ENCRYPTION_KEY` unchanged. In addition to Google tokens it now encrypts administrator authenticator secrets and the optional AI provider credential.
- The image runs Node.js 24.22.1. No new environment variable is required.
- The AI assistant stays disabled after the update; two-step verification is off for every account until an administrator enables it.
- Rolling back to 3.0.0 after these migrations means restoring the matching pre-update data copy together with the 3.0.0 image. Do not run 3.0.0 against the migrated databases.

<!-- Compatibility anchors for previously published guide links. -->

<span id="atualizacao-segura-com-docker-compose"></span>
<span id="backup-atualizacao-e-recuperacao-na-v2"></span>
<span id="backup-manual"></span>
<span id="restauracao"></span>
