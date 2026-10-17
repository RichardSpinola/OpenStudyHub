# Optional Google integration

OpenStudyHub works without Google. **Classroom is a personal, read-only connection**; each user connects and maps their own classes. **Central Drive is instance-managed storage**, designated by Admin from an authorized connected account. Choosing its owner does not reveal everybody's personal Classroom.

## Configure the OAuth client

1. In [Google Cloud Console](https://console.cloud.google.com/), choose the instance's project. Enable Classroom, Drive and Docs APIs; enable Picker only if selecting existing Docs through Picker.
2. Configure the consent screen and test users when the OAuth application is in Testing. Review Google's verification requirements for broader access.
3. Create a **Web application** OAuth client. Keep its Client ID and Client Secret in the private server environment.
4. Register the exact callback: `APP_URL + /api/v2/google/callback`. Example: `https://hub.example.org/api/v2/google/callback`. Scheme, host, port and path must match. Admin is not the OAuth callback surface.

For local QA, register the exact local origin/port separately. Do not change production credentials simply to bypass a local redirect error. See [Google's web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server).

## Private configuration

Set `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` and `GOOGLE_TOKEN_ENCRYPTION_KEY` on the services that need the integration. The key is random 32-byte Base64; preserve it through updates. Restart App/Admin after changes. The installer creates an initial key, but does not request OAuth secrets.

Picker additionally needs restricted `GOOGLE_PICKER_API_KEY` and `GOOGLE_CLOUD_PROJECT_NUMBER`. Optional starter-template file IDs belong only in private configuration. Never commit OAuth codes, tokens, cookies, real keys or private Drive/Classroom IDs.

## Permissions and content

Initial connection requests `openid`, `email` and these Classroom scopes:

```text
https://www.googleapis.com/auth/classroom.courses.readonly
https://www.googleapis.com/auth/classroom.coursework.me.readonly
https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly
https://www.googleapis.com/auth/classroom.announcements.readonly
```

The optional Drive flow adds `https://www.googleapis.com/auth/drive.file`. It is limited to files created or explicitly authorized for the application; pasting an arbitrary document URL does not grant access. [Google's scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) explains the distinction.

In Settings → Integrations, connect, discover Classrooms, review and confirm associations, then synchronize. Announcements, coursework and **materials** are separate content types. Check the last sync if a teacher's material appears missing. Old cached content can remain visible while a connection needs reconnection.

## Drive storage and repair

Admin → Integrations → Storage selects the central owner and prepares the root. Academic paths follow institution/course/cohort/period/subject context. Projects use a descriptive branch such as `Projetos - ADS`; private templates are grouped under `Modelos` and the person's name. These folder labels are currently Portuguese. Rely on stored references rather than guessing folders by name.

If a root is missing, inspect its status and use the explicit create/recover action. Recovery can preserve an old reference instead of silently duplicating folders. Google can refuse an operation on files created by another OAuth client, even when the account owns them. Inspect permissions or manage those files in Drive directly; do not grant broader scopes just to hide an error.

Normal upgrades do **not** reset the library or recreate all folders. Remote Drive files are not downloaded into local backups. See [backup/update](backup-update.md).

<!-- Compatibility anchors for previously published guide links. -->

<span id="configurar-no-google-cloud"></span>
<span id="google-na-v2-classroom-drive-e-docs"></span>
<span id="scopes-usados"></span>
<span id="uso-no-openstudyhub"></span>
<span id="variaveis-privadas"></span>
