# Architecture

## One instance, separate responsibilities

The Next.js App serves study workflows. Admin is a separate request surface with its own authentication realm. A realtime Node service handles collaboration and backup scheduling; Caddy forwards App traffic and WebSockets. Migrations run before application services.

The legacy/main SQLite database and canonical academic SQLite database coexist intentionally. A projection/identity bridge connects existing workspace records to canonical users and academic offerings. `v2` in internal paths identifies this architecture and remains for compatibility. Do not merge the databases, rename runtime variables or edit applied migrations as a documentation cleanup.

## Persistence and boundaries

Private assets and local project versions live in the persistent data volume; notes and some image/state data live in SQLite. Google stores optional remote documents/projects. OAuth credentials are private server configuration; encrypted refresh tokens belong to their connection, not browser code. Personal Classroom access and central Drive ownership are distinct.

App, Admin, realtime and the migration service must agree on database/asset paths and encryption configuration. Keep Admin private and preserve the volume across image replacement. See [deployment](deployment.md), [Google](google.md) and [recovery](operations/manual-backup-restore.md).
