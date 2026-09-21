# Backup e atualização

A V1 usa atualização manual. O updater automático fica para uma versão futura.

## O que precisa de backup

Sempre preserve:

1. arquivo indicado por `DATABASE_PATH`;
2. diretório indicado por `PRIVATE_ASSET_PATH`;
3. `.env` ou o segredo equivalente fora do Git;
4. especialmente `GOOGLE_TOKEN_ENCRYPTION_KEY`.

Arquivos canônicos do Google Drive não são copiados para SQLite.

## SQLite

Evite copiar um banco SQLite em escrita ativa de forma ingênua. Prefira parar a aplicação durante o backup simples ou usar uma ferramenta SQLite consciente de WAL/backup.

Fluxo simples para uma instalação pequena:

```bash
docker compose -f docker-compose.example.yml stop openstudyhub
# copie o volume/diretório persistente para um local seguro
docker compose -f docker-compose.example.yml start openstudyhub
```

## Atualizar código/container

1. Leia o changelog.
2. Faça backup.
3. Obtenha a release desejada.
4. Rebuild/recrie o container ou reinstale dependências no deploy Node.
5. Aplique migrations versionadas.
6. Verifique `/api/health`.
7. Faça um smoke test de login, Home, Disciplinas e integrações usadas.

Com Docker Compose:

```bash
docker compose -f docker-compose.example.yml build --pull
docker compose -f docker-compose.example.yml up -d
```

O entrypoint do exemplo roda migrations antes de iniciar a aplicação.

## Rollback

Rollback de código não implica rollback seguro de schema. Se uma atualização de migration causar problema, restaure o backup correspondente do banco e private-assets junto da versão anterior do código.

Nunca tente apagar migrations já aplicadas numa instância real para “voltar”.
