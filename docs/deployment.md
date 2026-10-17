# Deployment and service layout

An instance consists of **migration, App, Admin, realtime and a local Caddy proxy**, with two SQLite databases and private assets in one persistent volume. Keep the five services in the same Compose project. Node development requires Node.js 24 and pnpm 10; a server using the ready-made image does not need either installed on its host.

| Service   | Responsibility                               | Host exposure             |
| --------- | -------------------------------------------- | ------------------------- |
| migration | Apply main and canonical database migrations | None; exits after success |
| App       | Student workspace                            | Through the local proxy   |
| Admin     | Setup and administration                     | Localhost 3001 by default |
| realtime  | Collaboration and backup scheduling          | Internal network          |
| web       | App and WebSocket routing                    | Localhost 3000 by default |

## Choose the installation method

- New Linux server with Docker: [guided installer](instalacao-do-zero.md).
- ZimaOS/CasaOS graphical manager: [ZimaOS](zimaos.md) or [CasaOS](casaos.md).
- Other Compose-capable hosts: manual installation below; [UmbrelOS limitations](umbrelos.md).

## Manual Compose

Copy `.env.example` to a private `.env`; set `NODE_ENV=production`, `APP_URL`, realtime public URL and a stable 32-byte Base64 `GOOGLE_TOKEN_ENCRYPTION_KEY`. The Compose template defines the database paths inside `/app/data`. Do not use the same path for both databases.

`docker-compose.example.yml`, the graphical template and the guided installer pin `ghcr.io/richardspinola/openstudyhub:3.0.0`. Keep App, Admin, migrations and realtime on the same image version. Follow the update guide for an existing instance; the installer is for a new one.

```sh
# Use only after checking the image version in the template:
docker compose -f docker-compose.example.yml config --quiet
docker compose -f docker-compose.example.yml up -d
```

Do not share the output of plain `docker compose config`: it can reveal secrets. The `--quiet` check validates without printing resolved configuration.

## Network and persistent data

Only App should be reachable publicly. Keep Admin loopback-bound or on a deliberately protected private address, never behind the public App proxy. Forward both `/realtime` and `/whiteboard` with WebSocket support. A public HTTPS origin requires `wss`, not `ws`.

`openstudyhub-data:/app/data` retains databases and assets across container recreation. `down -v` deletes a Compose volume: it is not an update command. Docker socket access is powerful; the application containers do not need it. Keep configuration files private and preserve the encryption key through updates.

## First health checks

Check App `/api/health`, Admin `/control/setup` on an empty instance or `/control/login` otherwise, and realtime availability. A health 200 can be degraded if realtime is unavailable; inspect its checks. Diagnose the migration service before retrying startup. [Updating and recovering](backup-update.md) explains data-preserving changes.

<!-- Compatibility anchors for previously published guide links. -->

<span id="atualizacao-e-recuperacao"></span>
<span id="dominio-e-cloudflare"></span>
<span id="instalacao-v2-com-docker"></span>
<span id="plataformas-domesticas"></span>
<span id="portas-e-persistencia"></span>
<span id="primeiro-deploy"></span>
