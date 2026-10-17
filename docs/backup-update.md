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

<!-- Compatibility anchors for previously published guide links. -->

<span id="atualizacao-segura-com-docker-compose"></span>
<span id="backup-atualizacao-e-recuperacao-na-v2"></span>
<span id="backup-manual"></span>
<span id="restauracao"></span>
