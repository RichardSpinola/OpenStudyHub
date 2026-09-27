# Instalação V2 com Docker

Se você vai hospedar o OpenStudyHub, comece decidindo quem pode acessar cada entrada. A comunidade usa o App; a configuração da instituição fica no Admin / Control Plane. O [Compose de exemplo](https://github.com/RichardSpinola/OpenStudyHub/blob/main/docker-compose.example.yml) usa a imagem pública fixa `ghcr.io/richardspinola/openstudyhub:2.0.0` e instala essas duas superfícies junto com colaboração em tempo real, proxy local e migrations; quem instala não precisa de PAT ou login no GHCR. O App pode receber tráfego público por HTTPS. O Admin deve ficar na rede local ou em acesso administrativo privado.

## Portas e persistência

| Serviço                 | Porta no host por padrão | Uso                                                     |
| ----------------------- | ------------------------ | ------------------------------------------------------- |
| `openstudyhub-web`      | `127.0.0.1:3000`         | App e WebSockets `/realtime` e `/whiteboard` pelo Caddy |
| `openstudyhub-admin`    | `127.0.0.1:3001`         | Admin `/control`, sem publicação pública                |
| `openstudyhub-app`      | interna `3000`           | Next.js do App                                          |
| `openstudyhub-realtime` | interna `3045`           | colaboração e presença                                  |
| `openstudyhub-migrate`  | sem porta                | aplica migrations V1 e V2 antes do App/Admin            |

O volume `openstudyhub-data` guarda os dois bancos SQLite, anexos privados, assets locais e backups em `/app/data`. Nunca exponha esse volume nem o Docker socket ao público. O `.env` privado guarda os segredos e deve ser incluído no plano de backup seguro, fora do Git.

## Primeiro deploy

1. Copie `.env.example` para `.env`. Configure `NODE_ENV=production`, `APP_URL` com a origem HTTPS pública, `OPENSTUDYHUB_V2_ENABLED=1`, `GOOGLE_REDIRECT_URI` se for usar Google e `OPENSTUDYHUB_REALTIME_PUBLIC_URL=wss://SEU-DOMINIO/realtime`. O Compose define os caminhos dos bancos dentro do volume.
2. Defina `OPENSTUDYHUB_APP_BIND=127.0.0.1`. Para acessar o Admin de outra máquina na LAN, use o IP LAN do host em `OPENSTUDYHUB_ADMIN_BIND`; mantenha firewall/restrição de rede. Nunca aponte o túnel público para `3001`.
3. Execute:

   ```sh
   docker compose -f docker-compose.example.yml up -d
   ```

4. Confira `http://127.0.0.1:3000/api/health` no host e a tela de login do Admin em `http://127.0.0.1:3001/control/login`. Em banco vazio, conclua o setup do primeiro administrador antes de abrir a instância ao público.

O serviço `openstudyhub-migrate` roda `migrate-production.mjs` e `migrate-v2-production.mjs` em sequência; App/Admin/realtime só iniciam depois de migrations concluídas. Não aponte os dois caminhos de banco para o mesmo arquivo.

## Domínio e Cloudflare

Termine HTTPS num reverse proxy ou Cloudflare Tunnel e encaminhe a origem pública apenas para `openstudyhub-web:3000` (ou `127.0.0.1:3000` quando o túnel roda no host). Preserve os caminhos `/realtime` e `/whiteboard` com upgrade WebSocket. Configure `APP_URL=https://seu-dominio` e `OPENSTUDYHUB_REALTIME_PUBLIC_URL=wss://seu-dominio/realtime`. O callback Google cadastrado no Cloud deve ser `https://seu-dominio/api/v2/google/callback`, sem slash extra. Veja [Google](google.md).

Se usar domínio LAN sem HTTPS, não espere que OAuth de produção aceite esse callback. Use HTTPS público para a integração real, ou o fluxo local `localhost`/`127.0.0.1` apenas para teste. Não exponha porta de SQLite, assets privados, Admin ou realtime diretamente na internet.

## Plataformas domésticas

O mesmo Compose é a base para [ZimaOS](zimaos.md), [CasaOS](casaos.md) e [UmbrelOS](umbrelos.md). Esses guias explicam o caminho manual e os limites de integração com as respectivas lojas. Não existe pacote de loja publicado nesta fase.

## Atualização e recuperação

Siga [Backup e atualização](backup-update.md) antes de substituir a imagem. O endpoint de saúde do App é `/api/health`; o Admin tem healthcheck próprio de login. A restauração de banco **não** acontece pelo navegador e exige App, Admin e realtime parados, conforme [guia operacional](operations/manual-backup-restore.md).
