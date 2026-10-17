# OpenStudyHub 3.0.0

A self-hosted study workspace with a reorganized user experience, administration, collaborative notes and optional Google integration. Use the pinned `ghcr.io/richardspinola/openstudyhub:3.0.0` image; follow the update guide before changing an existing instance.

## Current workspace

Home/search/shortcuts, a compact timetable, subject materials, pages/databases/private images in Notes, Library/project workflows, inline chat edits and attachments, study tools, reorganized settings, personal planning and a replayable tour. Admin has a dedicated academic structure and clearer setup, integration and storage controls. Local storage works without Google; central Drive remains optional.

## Deployment compatibility

Keep both databases, private assets, environment, encryption key and Compose volume/project. Apply new migrations in order; preserve existing applied SQL. Technical names `v2.db`, `v2-migrations` and `OPENSTUDYHUB_V2_*` remain intentional. A normal update does not reset the library, recreate Drive or discard accounts.

Create an external recovery copy first. If rolling back after migrations, restore the matching data and image together. Remote-only Drive files are not part of local backups. Files belonging to another OAuth client can still be refused by Google's `drive.file` policy; the Hub reports the failure instead of deleting local references blindly.

## Documentation and installation

English documentation is the default, with complete Português (Brasil), real fictional-data captures and a redesigned public site. The new installer creates a new instance using existing Docker/Compose and offers read-only diagnosis; it is not an updater. The installer and Compose examples use the versioned 3.0.0 image. The initial application setup wizard still has Portuguese labels, documented explicitly.

See [installation](docs/instalacao-do-zero.md), [updates](docs/backup-update.md), [credits](docs/LICENSING.md) and [publication checklist](docs/release-checklist.md). Previous notes: [2.0.1](RELEASE_NOTES_2_0_1.md), [2.0.0](RELEASE_NOTES_2_0_0.md).
