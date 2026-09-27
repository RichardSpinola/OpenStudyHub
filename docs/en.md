# OpenStudyHub V2 — English guide

OpenStudyHub brings classes, coursework, files and conversations into a space your institution can host. Students and staff use the **App** every day; administrators set up courses, people and access in a separate **Control Plane**. You can start without Google and connect Classroom or Drive later. The Docker example serves the App on host port `3000` and binds Admin to `127.0.0.1:3001` by default. Keep Admin on a private network.

## What is included

An administrator creates the institution, courses, cohorts and academic periods, then connects subjects to their offerings and enrollments. Users see their schedule and coursework in Today. If they choose Google, each person connects their own account, finds Classrooms, checks the suggested matches and confirms the right subjects before syncing read-only Classroom data. Drive is optional; an Admin may appoint a connected ordinary user as the central Drive owner for documents and folders.

Notes, Documents, Projects and Chat support daily work and explicit sharing. Extras contains the collaborative Global Whiteboard and optional minigames; Admin controls visibility at instance level. Appearance and shortcuts can be personalized. A New Tab browser extension can open the chosen OpenStudyHub instance without storing a password.

## Install with Docker

Start with the [Compose file](https://github.com/RichardSpinola/OpenStudyHub/blob/main/docker-compose.example.yml), which uses the public pinned image `ghcr.io/richardspinola/openstudyhub:2.0.0` without a GitHub account or PAT, if you want one installation with the App, Admin, realtime WebSocket, Caddy proxy and migrations. Copy `.env.example` to a private `.env`; set `NODE_ENV=production`, an HTTPS `APP_URL`, separate SQLite paths for the main and V2 databases, and a persistent `/app/data` volume. Keep the Admin bind address private. Run `docker compose -f docker-compose.example.yml up -d`, then check `/api/health` on the App and finish first-run setup at `/control/setup` on Admin.

Do not expose the data volume, Admin port or realtime service directly to the internet. A reverse proxy or Cloudflare Tunnel should route the public hostname to the App proxy, including the `/realtime` and `/whiteboard` WebSocket paths. The ZimaOS, CasaOS and UmbrelOS guides describe **manual Compose deployment**; native app-store packages have not been published.

## Google Classroom and Drive

Create a Google Cloud project, enable the Classroom, Drive and Docs APIs, and create a **Web application** OAuth client. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL` and a 32-byte base64 `GOOGLE_TOKEN_ENCRYPTION_KEY` in the private environment. Set `GOOGLE_REDIRECT_URI` to the exact value `APP_URL` plus `/api/v2/google/callback`; for the example hostname it is `https://hub.example.org/api/v2/google/callback`. Register that URI on the OAuth client in Google Cloud Console. When the consent screen is in Testing mode, add intended test users there.

The App requests `openid`, `email`, `classroom.courses.readonly`, `classroom.coursework.me.readonly`, `classroom.courseworkmaterials.readonly` and `classroom.announcements.readonly`. The optional Drive flow requests `drive.file`. Google Picker for existing files additionally needs its API key and Cloud project number. Do not put secrets in the repository or browser extension. See the [full Google setup guide](google.md) for the exact variable names and steps.

## Backup, restore and updates

Create and download a backup using the Admin operations flow. The archive holds snapshots of both SQLite databases and local assets. It does not copy remote Drive files. For a critical upgrade, pause writes, keep an external copy, replace the image, run migrations and check health. Restoring the databases requires **App, Admin and realtime stopped**; it is not an online browser restore. Read the [backup and update procedure](backup-update.md) before upgrading.

## Browser extension

The shared Manifest V3 package in [`extension/openstudyhub-new-tab/`](https://github.com/RichardSpinola/OpenStudyHub/tree/main/extension/openstudyhub-new-tab) replaces the New Tab page in compatible Chromium browsers and Firefox. Set the base URL in the extension options and test opening the instance. Firefox temporary add-ons disappear after browser restart; a permanent Firefox install needs signing. The extension uses only local `storage` permission and the normal OpenStudyHub web session. See the [browser-by-browser tutorial](extension.md).

For Chrome, Edge, Brave or Vivaldi, open the browser's Extensions page, enable developer mode where available, choose **Load unpacked**, select the shared extension folder, then set and test the instance URL in the extension options. In Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, select `manifest.json`, configure the URL and open a new tab. New Tab override does not change the browser homepage or New Window behavior. Disable or remove the extension from the browser's add-on manager.

## Architecture and everyday use

The App and Control Plane are separate surfaces of one installation. The App serves ordinary users; `/control` is the administrative surface. A realtime service handles collaboration and presence, while the local proxy routes browser traffic and WebSockets. The two SQLite files and private assets live in a persistent data volume. Keep the Admin port and data volume private.

In the App, **Subjects** shows enrolled offerings, **Today** combines schedule and coursework, **Notes** keeps personal writing, **Documents** supports local files and optional Google Docs workflows, **Projects** manages files and versions, and **Chat** handles conversations and attachments. Extras is optional: Admin enables the Global Whiteboard and each minigame. The whiteboard is collaborative, persistent and uses the normal OpenStudyHub session. Excalidraw attribution remains in the product's software credits.

## Home server deployment

On ZimaOS, CasaOS or UmbrelOS hosts with Docker Compose, keep all five services together: migration, App, Admin, realtime and proxy. Set `APP_URL`, `OPENSTUDYHUB_REALTIME_PUBLIC_URL`, the persistent data volume and, if Google is used, the callback URI before starting. Bind Admin to localhost or a firewalled LAN address with `OPENSTUDYHUB_ADMIN_BIND`. These are manual host installations, not one-click store packages. If an UmbrelOS host does not expose Docker Compose, this method does not apply.

## Backup and recovery details

The backup ZIP includes both SQLite snapshots and private local assets, but no remote Drive files. It contains personal data and password hashes, so store it securely outside the repository. Keep `.env` secrets in a separate vault. Backup copies remove sessions, OAuth state and refresh tokens; users sign in and reconnect Google after a restore. If an update fails after migrations, restore the matching pre-update data snapshot together with its matching code or image. Do not run older code against a newer schema.

## Troubleshooting

If the App does not start, check the migration service first, then `/api/health`, volume permissions and the two distinct database paths. If Google returns `redirect_uri_mismatch`, compare the full callback URI in Google Cloud Console with `GOOGLE_REDIRECT_URI` and `APP_URL`; scheme, host, port and path must agree. If realtime collaboration fails, check the `/realtime` and `/whiteboard` WebSocket proxy routes. If a document cannot reach Drive, check the connected storage owner, granted Drive scope and folder status in Admin. Never paste OAuth codes, tokens, cookies or encryption keys into a report.

## More information

- [Projects and document templates](modelos-personalizados.md)
- [Admin and operations](deployment/ADMIN_GUIDE.md)
- [Troubleshooting](troubleshooting.md)
- [AGPL-3.0 license](LICENSING.md)
- [Source code](https://github.com/RichardSpinola/OpenStudyHub)

The linked step-by-step reference pages are currently in Portuguese; this page provides the public V2 overview and operating instructions in English.
