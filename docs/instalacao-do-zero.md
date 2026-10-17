# Install a new server

## Before you start

Use a Linux host with Docker Engine and Docker Compose v2 already working, Bash, GNU coreutils (including `realpath -m`), `awk` and at least 2 GiB free for initial data. Uploads, images and backups require additional space. The installer does not install Docker, configure DNS/TLS/firewalls or update existing instances. It uses prebuilt images, not an on-server source build.

The installer uses the pinned `ghcr.io/richardspinola/openstudyhub:3.0.0` image. Check the [release notes](https://github.com/RichardSpinola/OpenStudyHub/releases/tag/v3.0.0) before installing. Use `--image` only to select another trusted, explicitly versioned image.

## 1. Obtain and inspect the project

Use a complete checkout or release source bundle from the [official repository](https://github.com/RichardSpinola/OpenStudyHub). Run the script from that checkout; downloading the script alone is insufficient because it uses the deployment templates. Review `scripts/install-server.sh` before running it. No `curl | sudo bash` command is required.

## 2. Run the wizard

```sh
bash scripts/install-server.sh
# Portuguese (Brazil):
bash scripts/install-server.sh --language pt-BR
```

The defaults are directory `./openstudyhub`, App `127.0.0.1:3000`, Admin `127.0.0.1:3001`. The wizard asks for directory, bind address, ports and the URL people will use. It displays a summary and requires `yes` before continuing. Choosing `0.0.0.0` deliberately exposes the App on host interfaces; configure host/network protection yourself. Admin stays on localhost.

For repeatable setup, supply the values explicitly and use `--yes` only after reviewing them:

```sh
bash scripts/install-server.sh --directory ./openstudyhub   --project openstudyhub --app-url http://127.0.0.1:3000   --app-bind 127.0.0.1 --app-port 3000 --admin-port 3001 --yes
```

The installer checks Docker access, existing project/volumes, ports and space; creates a private configuration with a random encryption key; runs both migrations; starts the five services; and checks readiness. It never adopts an existing instance. If it stops, preserve the directory, volume and private `install.log`; use [troubleshooting](troubleshooting.md). Do not retry by deleting the data volume.

## 3. Open private Admin

On the host: `http://127.0.0.1:3001/control/setup`. For a remote server, keep the port private and forward it from your own computer:

```sh
ssh -N -L 3001:127.0.0.1:3001 YOUR_USER@YOUR_SERVER
```

Then open the same localhost URL on your computer. If local port 3001 is occupied, change only the leftmost port in the forwarding command and open that port. Use your own SSH account; this is not an OpenStudyHub username.

Complete language, first Admin, institution, course and academic structure; review the final summary. Credentials are created in this setup, not by the installer. The account creation flow for students is managed separately by the Admin.

## 4. Publish the App when ready

Put only the App behind your HTTPS reverse proxy/tunnel. Set `APP_URL` to that exact public origin and `OPENSTUDYHUB_REALTIME_PUBLIC_URL` to its `wss://.../realtime` address; preserve `/realtime` and `/whiteboard` WebSocket routes. Restart services after configuration changes. Admin must remain private.

Google and Brave autocomplete can be configured later. [Google](google.md) explains OAuth; [deployment](deployment.md) explains service layout and manual installation.

## Diagnose without changing data

```sh
bash scripts/install-server.sh --diagnose --directory ./openstudyhub
```

It validates Compose, lists service state and checks App/Admin, proxy and realtime health and the running version without printing environment values. Custom project names are recorded by the installer. Raw logs may contain private information: inspect them privately.

> The current first-run wizard has Portuguese labels, including when English is selected. The choice sets the instance language after setup; the screenshot shows the real interface. This documentation change does not translate application code.

## Installer options

| Option                                  | Purpose                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `--language en` / `--language pt-BR`    | Choose the installer language; English is the default.                                   |
| `--directory PATH`                      | New, empty installation directory. Never point at an existing instance.                  |
| `--project NAME`                        | Unique Docker Compose project name. Recorded for later diagnosis.                        |
| `--app-bind IPv4`                       | Default `127.0.0.1`. Choose a private interface or `0.0.0.0` deliberately.               |
| `--app-port PORT` / `--admin-port PORT` | Two different ports from 1024 to 65535. Admin remains on localhost.                      |
| `--app-url URL`                         | Exact HTTP(S) origin, without a path, query or credentials.                              |
| `--image IMAGE:VERSION`                 | Explicit, trusted version. No `latest`; defaults to the public 3.0.0 image.              |
| `--yes`                                 | Accept the displayed configuration without an interactive prompt.                        |
| `--diagnose`                            | Check an installer-managed instance without starting services or changing configuration. |
| `--help`                                | Display command usage.                                                                   |

The installer stores `compose.yml`, `Caddyfile`, `.env`, `instance-project` and a private `install.log` in the chosen directory. Application data live in the named Docker volume, not beside `.env`. Keep both the volume backup and the private configuration, especially the encryption key.

<!-- Compatibility anchors for previously published guide links. -->

<span id="1-escolha-o-endereco-publico"></span>
<span id="10-backup-inicial"></span>
<span id="2-prepare-os-dados-persistentes"></span>
<span id="3-crie-o-env"></span>
<span id="4-suba-a-aplicacao"></span>
<span id="5-faca-o-primeiro-setup"></span>
<span id="6-configure-google-do-zero"></span>
<span id="7-defina-a-conta-de-armazenamento"></span>
<span id="8-cadastre-usuarios-e-offerings"></span>
<span id="9-teste-antes-de-colocar-dados-reais"></span>
<span id="instalacao-do-zero"></span>
