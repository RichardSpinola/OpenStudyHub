# CasaOS

Use the complete `deploy/zimaos-compose.yml` custom-app import template in CasaOS. Import all five services together, with a persistent `openstudyhub-data` volume. This is a manual Compose installation, not an official app-store package.

The template pins the 3.1.0 image for all Hub services. Use the update guide when preserving an existing installation.

1. Inspect the template and image tag before import.
2. Set the App origin and realtime public URL consistently for App, Admin and realtime.
3. Keep the Admin port bound to localhost or a protected private LAN address. Publish only App through HTTPS.
4. Wait for migrations, then check App health and open private Admin setup.
5. Configure Google later, if required.

For remote localhost Admin, use the SSH forwarding example in [installation](instalacao-do-zero.md). Preserve the manager's project, mounts and configuration on updates. Do not run the first-install script over the managed installation. See [updates](backup-update.md).
