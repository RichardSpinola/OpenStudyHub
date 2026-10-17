<p align="center"><img src="public/brand/openstudyhub-icon.png" alt="OpenStudyHub" width="96" /></p>

# OpenStudyHub

[English](README.md) · [Português (Brasil)](README.pt-BR.md) · [Documentation](https://richardspinola.github.io/OpenStudyHub/)

**Your study day, in one self-hosted workspace.**

OpenStudyHub brings classes, materials, notes, files and conversations together. Students use the App; the people running the instance use a separate private Admin. Start with local accounts and storage, then connect Google Classroom or Drive if you need them.

![Home with fictional institution and study content](docs/assets/screens/en/home.jpg)

<a id="o-que-a-v2-oferece"></a>

## What you can do

| Area           | Capabilities                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Your day       | Customizable Home, search and shortcuts; weekly schedule, upcoming classes, academic events, deadlines, personal tasks and calendar export |
| Subjects       | Enrolled subject workspaces with notices, coursework, materials and associated notes/documents/projects                                    |
| Notes          | Private pages and subpages, rich blocks, simple table/board databases, images, sharing, recovery drafts and exports                        |
| Library        | Local files, template-based documents, personal or subject-associated projects, versions, sharing, archive and deletion                    |
| Community      | Global chat, groups and direct conversations; inline message editing, attachments and drag-and-drop uploads                                |
| Study tools    | Collaborative whiteboard, nine games, Pomodoro focus timer and flashcards, enabled by the administrator                                    |
| Your space     | Profile, themes, wallpaper framing/blur, motion and contrast settings, notifications and a replayable guided tour                          |
| Administration | First-run setup, institutions, courses, cohorts/periods, subjects/covers, enrollments, accounts and scoped responsibilities                |
| Operations     | Optional Google integration, central Drive controls, backup/recovery, diagnostics and a configurable user-login footer                     |

### Google is optional

Notes, local files and local projects work without Google. Each user connects their own **read-only Classroom** and confirms the subject mapping. The administrator separately designates an authorized account for **central Drive**. Google-backed document generation requires that storage; a local project is not automatically mirrored to Drive. [Integration guide](docs/google.md).

### Your instance, your data

The App, private Admin, realtime service, migrations and local proxy share persistent data: two SQLite databases and private assets. The public App can use HTTPS while Admin stays on localhost or a protected private network. Backups cover managed local data; remote-only Drive files require their own protection.

## Get started

- **Using an existing instance?** Ask its administrator for the address and a local account. Start with the [first-visit guide](docs/getting-started.md).
- **Hosting a new instance?** Follow [installation](docs/instalacao-do-zero.md). The guided Bash installer uses existing Docker/Compose and refuses to overwrite an existing installation.
- **Updating?** Read [backup and update](docs/backup-update.md). Do not rerun the first-install wizard or remove volumes.

> **Version 3.0.0:** use the pinned `ghcr.io/richardspinola/openstudyhub:3.0.0` image. See the [release](https://github.com/RichardSpinola/OpenStudyHub/releases/tag/v3.0.0) and follow the [update guide](docs/backup-update.md) for an existing instance. The guided installer is for new instances only.

```sh
# From a complete trusted checkout, after the public image is available:
bash scripts/install-server.sh
# Read-only diagnosis for an installer-managed instance:
bash scripts/install-server.sh --diagnose --directory ./openstudyhub
```

Default addresses are App `127.0.0.1:3000` and Admin `127.0.0.1:3001`. The installer does not install Docker, set up a domain/TLS, open firewall rules or update existing instances. [Full instructions and SSH access](docs/instalacao-do-zero.md).

## Explore the workspace

[![Notes with fictional content](docs/assets/screens/en/notes.jpg)](docs/notas.md)

- [Home, Today and subjects](docs/workspace.md)
- [Notes, databases and images](docs/notas.md)
- [Library, documents and projects](docs/library.md) · [Custom templates](docs/modelos-personalizados.md)
- [Chat, whiteboard, games, focus and flashcards](docs/chat-e-extras.md)
- [Personal planning and guided tour](docs/agenda-e-tour.md) · [Settings](docs/configuracoes.md)
- [Admin guide](docs/deployment/ADMIN_GUIDE.md) · [Deployment](docs/deployment.md)
- [ZimaOS](docs/zimaos.md), [CasaOS](docs/casaos.md), [UmbrelOS](docs/umbrelos.md)
- [Recovery](docs/operations/manual-backup-restore.md) · [Troubleshooting](docs/troubleshooting.md)
- [New Tab extension](docs/extension.md)

All walkthroughs have a complete **Português (Brasil)** edition. Screenshots use fictional local data. The current first-run setup still has Portuguese labels; the English guide explicitly records that interface limitation.

## Develop and contribute

Use Node.js 24 and pnpm 10. Keep `.env`, databases, uploads and backups out of Git. Use a disposable development instance, never the real server data. See [contribution instructions](CONTRIBUTING.md), [architecture](ARCHITECTURE.md) and [security reporting](SECURITY.md).

For the bilingual documentation preview:

```sh
bash scripts/preview-docs.sh
# Build/check both editions without starting the preview:
bash scripts/preview-docs.sh --build-only
```

## License, credits and versions

OpenStudyHub is **AGPL-3.0-only**. Third-party components keep their original licenses and notices, including Excalidraw, BlockNote and Yjs. Read [LICENSE](LICENSE), [third-party notices](THIRD_PARTY_NOTICES.md) and [licensing guide](docs/LICENSING.md). Development uses AI assistance under the maintainer's direction; see [AI usage](AI_USAGE.md).

The product description covers the current workspace. Version-specific history belongs in [CHANGELOG](CHANGELOG.md) and [release notes](RELEASE_NOTES.md). Community instances are independently operated; use an accurate affiliation statement for your institution.
