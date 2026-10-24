# Changelog

## 3.1.0

Optional administrator two-step verification (TOTP and single-use recovery codes, terminal recovery) and an optional local AI assistant for Ollama/OpenAI-compatible servers with private and group conversations, selected sources, attachments and `@IA` chat replies. Security dependency updates and Node.js 24.22.1. See [release notes](RELEASE_NOTES_3_1_0.md).

## 3.0.0

Reorganized Home, timetable, subjects, Library/projects, Admin and settings; collaborative note pages/databases/images; chat files and inline editing; games, focus, flashcards, personal planning and guided tour. Added recoverable Drive controls and configurable login footer/search behavior. Bilingual documentation and first-install/diagnostic tooling are prepared separately from publication. See [3.0.0 release notes](RELEASE_NOTES_3_0_0.md).

## 2.0.1

Fixed the Control Plane login loop when Admin uses trusted LAN HTTP and the App uses HTTPS. Admin cookies follow the request origin, retaining Secure on HTTPS, HttpOnly, SameSite=Lax, host isolation and logout revocation. Updated graphical Compose image references. [Historical hotfix notes](RELEASE_NOTES_2_0_1.md).

## 2.0.0

Introduced canonical academic structure, separate App/Admin surfaces, personal read-only Classroom, optional central Drive/Docs, study workspace, realtime collaboration, configurable Extras, backups, New Tab extension and self-hosted Compose deployment. [Historical release notes](RELEASE_NOTES_2_0_0.md).

[Português (Brasil)](docs/pt-BR/releases.md). Earlier project history remains in `archive/public-history-v1.md` and Git tags.
