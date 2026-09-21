# Deploy

A V1 pode rodar como servidor Node.js ou em Docker.

## Princípio de exposição

Em produção use HTTPS e um reverse proxy em frente ao Next.js. Não exponha SQLite, private-assets nem Docker socket.

A documentação oficial do Next.js recomenda um reverse proxy para self-hosting:

https://nextjs.org/docs/app/guides/self-hosting

## Docker Compose

```bash
cp .env.example .env
```

Edite pelo menos:

```env
NODE_ENV=production
APP_URL=https://hub.exemplo.com
DATABASE_PATH=/app/data/openstudyhub.db
PRIVATE_ASSET_PATH=/app/data/private-assets
```

Depois:

```bash
docker compose -f docker-compose.example.yml up -d --build
```

O exemplo publica `127.0.0.1:3000`, adequado quando o reverse proxy está no mesmo host. Se o proxy estiver em outra rede Docker, adapte a rede/porta em vez de publicar indiscriminadamente a aplicação na internet.

O container aplica migrations versionadas antes de iniciar o Next.js.

## Health check

```text
GET /api/health
```

Resposta saudável: HTTP 200 com aplicação e banco `operational`.

## Volumes

Persistir `/app/data` preserva:

- SQLite;
- avatares/banners;
- anexos privados de chat;
- favicons cacheados;
- outros private-assets gerenciados.

## Reverse proxy

O proxy deve:

- terminar HTTPS;
- encaminhar para a porta interna do Hub;
- preservar `Host` e headers de proxy adequados;
- aplicar limites razoáveis de request/body/timeout;
- não expor arquivos privados diretamente.

`APP_URL` e `GOOGLE_REDIRECT_URI` precisam refletir o endereço público real.

## ZimaOS

ZimaOS pode executar o container/Compose, mas não faz parte dos requisitos do projeto público. Use o Compose como base e adapte volumes/porta/reverse proxy à instalação local.

## Indicadores de ambiente na interface

Em desenvolvimento o cabeçalho mostra `SYS:DEVELOPMENT` para deixar claro que a
instância não é de produção. Em `NODE_ENV=production` esse indicador é ocultado.

O rodapé usa `SELF-HOSTED` como descrição da instalação; ele não representa o
status de conectividade da internet.
