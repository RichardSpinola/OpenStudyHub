# UmbrelOS

This project does not ship an official Umbrel app-store package. Use the manual [Compose deployment](deployment.md) only if your host exposes Docker Compose and permits the required persistent mounts/networking. If it does not, this method does not apply.

Keep migration, App, Admin, realtime and proxy together. Configure private environment, persistent data, public App origin and WebSockets; retain Admin on localhost/private access. Complete setup after health succeeds. Do not assume a Compose example is compatible with an unsupported graphical importer.

Before updating, preserve the host's configuration and volume and follow [backup/update](backup-update.md).
