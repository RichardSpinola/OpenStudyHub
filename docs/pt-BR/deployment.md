# Implantação e serviços

Uma instância reúne **migration, App, Admin, realtime e proxy Caddy local**, com dois bancos SQLite e assets privados em um volume persistente. Mantenha os cinco serviços no mesmo projeto Compose. Desenvolvimento Node usa Node.js 24 e pnpm 10; um servidor com imagem pronta não precisa dessas ferramentas no host.

| Serviço   | Responsabilidade                                   | Exposição no host             |
| --------- | -------------------------------------------------- | ----------------------------- |
| migration | Aplicar migrations dos bancos principal e canônico | Nenhuma; encerra após sucesso |
| App       | Espaço dos estudantes                              | Pelo proxy local              |
| Admin     | Setup e administração                              | Localhost 3001 por padrão     |
| realtime  | Colaboração e agendamento de backup                | Rede interna                  |
| web       | Encaminhar App e WebSocket                         | Localhost 3000 por padrão     |

## Escolha o método

- Servidor Linux novo com Docker: [instalador guiado](instalacao-do-zero.md).
- Gerenciador gráfico ZimaOS/CasaOS: [ZimaOS](zimaos.md) ou [CasaOS](casaos.md).
- Outros hosts com Compose: instalação manual abaixo; [limites do UmbrelOS](umbrelos.md).

## Compose manual

Copie `.env.example` para `.env` privado; defina `NODE_ENV=production`, `APP_URL`, URL pública de realtime e uma `GOOGLE_TOKEN_ENCRYPTION_KEY` estável de 32 bytes em Base64. O modelo Compose define os bancos em `/app/data`. Não use o mesmo caminho para os dois bancos.

`docker-compose.example.yml`, o modelo gráfico e o instalador guiado fixam `ghcr.io/richardspinola/openstudyhub:3.2.0`. Mantenha App, Admin, migrations e realtime na mesma versão de imagem. Siga o guia de atualização para uma instância existente; o instalador é para uma nova.

```sh
# Use somente depois de conferir a versão da imagem no modelo:
docker compose -f docker-compose.example.yml config --quiet
docker compose -f docker-compose.example.yml up -d
```

Não compartilhe a saída de `docker compose config` sem `--quiet`: ela pode revelar segredos. A verificação silenciosa valida sem imprimir a configuração resolvida.

## Rede e dados persistentes

Somente o App deve ficar público. Mantenha o Admin em loopback ou endereço privado protegido, nunca pelo proxy público do App. Encaminhe `/realtime` e `/whiteboard` com WebSocket. Uma origem pública HTTPS precisa de `wss`, não `ws`.

`openstudyhub-data:/app/data` preserva bancos e assets ao recriar containers. `down -v` apaga o volume: não é comando de atualização. Acesso ao socket Docker é poderoso; os containers do aplicativo não precisam dele. Proteja os arquivos de configuração e preserve a chave de criptografia nas atualizações.

## Primeiras verificações

Confira `/api/health` do App, `/control/setup` do Admin vazio ou `/control/login` nos demais casos, e realtime. Um health 200 pode indicar estado degradado quando realtime falha; confira os checks. Investigue o serviço de migrations antes de repetir a inicialização. Veja [atualização e recuperação](backup-update.md).

<!-- Compatibility anchors for previously published guide links. -->

<span id="atualizacao-e-recuperacao"></span>
<span id="dominio-e-cloudflare"></span>
<span id="instalacao-v2-com-docker"></span>
<span id="plataformas-domesticas"></span>
<span id="portas-e-persistencia"></span>
<span id="primeiro-deploy"></span>
