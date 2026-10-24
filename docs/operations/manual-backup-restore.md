# Backup and offline recovery

## Configure the backup routine

In Admin → System → Backup, generate and download the recovery key, store it separately and confirm that you kept it. Choose local server storage or local storage plus central Drive. The latter requires an authorized central Drive. Enable the daily routine, timezone and retention only when ready. Manual copies are separate from automatic retention.

Packages use `.oshbackup`, AES-256-GCM and a unique nonce. The server retains a protected key for scheduling; encryption protects the exported package, not a compromised server. The private control directory uses 0700 and the key file 0600. Preserve the original key; old packages depend on it.

## Included and excluded data

Packages include both SQLite databases, local notes/images, private assets, chat files and local project versions, with a checksum inventory. Missing referenced local files prevent a successful package. Files stored **only on Drive or another remote site are not downloaded**. Their references can remain in the database without the remote bytes being recoverable locally.

Sessions, OAuth states, push subscriptions and Google refresh tokens are removed from backup copies. Private content and password hashes remain. Environment files and deployment secrets are not included. Restore requires configuring those separately and reconnecting Google/push. Keep a copy and key outside the server.

## Consistency, scheduling and limits

The snapshot briefly pauses new application operations while both databases and managed assets are copied consistently. Compression, encryption and Drive transfer use streams afterward. A process lock prevents concurrent backups. The realtime service checks the schedule every minute; an alternative worker is `node dist/backup-worker.mjs` in the built image. Use the same data paths and control volume.

A missing worker heartbeat is shown in Admin. The routine attempts once per day after the chosen time; it does not replay every missed day. Only completed automatic copies beyond retention are removed. Manual copies and failures remain. A Drive failure after local success is reported as local-only success.

Reserve staging space. Limits include 19,997 assets, 1 GiB per asset and 4 GiB of assets, subject also to the 4 GiB package validation limit. Uploads can need retrying during a snapshot.

## Validate an encrypted backup

Use a disposable recovery target and paths inside its mounted volume. Never put a recovery key directly in command arguments:

```sh
# Inside a container with the recovery target volume mounted at /app/data:
DATABASE_PATH=/app/data/app.db OPENSTUDYHUB_V2_DATABASE_PATH=/app/data/v2.db PRIVATE_ASSET_PATH=/app/data/private-assets node dist/restore-encrypted-backup.mjs /app/data/backup.oshbackup   --key-file /app/data/recovery-key.txt --validate-only
```

Use your actual backup/key filenames. Validation authenticates/decrypts the package and checks entries, paths, inventory, checksums and SQLite integrity/foreign keys. `--validate-only` does not replace target data.

## Apply offline recovery

Stop **App, Admin, realtime and any separate backup worker**. Make an additional external copy of the current target data. Run the same command with `--confirm-restore --services-stopped` instead of `--validate-only`. The tool preserves previous target files with recovery suffixes; do not remove them until recovery is accepted. Configure the matching image and environment, run the required migrations, start services and check health. Do not run this against a live server.

The older sanitized unencrypted ZIP export remains available as a legacy option. It contains private data and password hashes in readable form and uses `scripts/restore-manual-backup.mjs`; it is not interchangeable with `.oshbackup`. Prefer the encrypted flow for new backups.

## Local AI and two-step verification data

Since 3.1.0, packages also include local AI conversations, their sources and uploaded files (`ai/` in private assets), the AI settings with the encrypted provider credential, and administrator two-step verification (encrypted authenticator secret and hashed recovery codes). Sign-in challenges, pending enrollments and running AI requests are not carried over: requests are marked as interrupted.

Encrypted values only work with the same `GOOGLE_TOKEN_ENCRYPTION_KEY`. If you restore with a different key, enter the AI credential again, and reset two-step verification for affected administrators with the [terminal recovery command](../admin-mfa.md#lost-authenticator-and-recovery-codes).

<!-- Compatibility anchors for previously published guide links. -->

<span id="agendamento"></span>
<span id="aplicar-a-recuperacao-offline"></span>
<span id="backup-e-recuperacao"></span>
<span id="compatibilidade-com-zip-antigo"></span>
<span id="configurar-pelo-admin"></span>
<span id="consistencia-e-consumo"></span>
<span id="o-que-e-recuperavel"></span>
<span id="validar-antes-de-restaurar"></span>
