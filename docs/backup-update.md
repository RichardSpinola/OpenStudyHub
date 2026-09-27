# Backup, atualização e recuperação na V2

Antes de atualizar, guarde uma cópia que você consiga restaurar. O backup do OpenStudyHub reúne os dados locais da instalação; arquivos que estão somente no Google Drive precisam do plano de proteção do próprio Drive. A restauração exige uma janela com os serviços parados.

## Backup manual

No Admin local, abra **Sistema → Backup manual → Criar backup** e baixe o ZIP gerado. Ele contém snapshots consistentes dos dois bancos SQLite e assets privados locais. O arquivo contém dados pessoais e hashes de senha: guarde-o em armazenamento protegido, fora do repositório e do volume principal. Preserve também o `.env`/segredos em cofre separado, especialmente `GOOGLE_TOKEN_ENCRYPTION_KEY`.

Os snapshots dos dois bancos são feitos em sequência. Para uma migração crítica, pause escritas numa janela de manutenção. O ZIP não copia conteúdo remoto do Google Drive e remove sessões, OAuth state, inscrições push e refresh tokens das **cópias**; depois de restaurar, usuários fazem login e reconectam Google. Os bancos em uso não têm tokens apagados ao criar o backup. Veja [detalhes operacionais](operations/manual-backup-restore.md).

## Atualização segura com Docker Compose

1. Leia as notas da nova versão. Crie e **baixe** o backup. Guarde também uma cópia externa do volume atual e do `.env`, além da referência da imagem/código anterior.
2. Atualize a tag fixa no Compose para a versão desejada e baixe a imagem pública (`docker compose -f docker-compose.example.yml pull`). Não remova o volume `openstudyhub-data`.
3. Execute `docker compose -f docker-compose.example.yml up -d`. O serviço de migrations aplica V1 e V2 antes dos serviços. Se a migration falhar, pare e investigue; não force App/Admin a iniciar com schema incompleto.
4. Verifique `/api/health`, login do Admin, login do App e ao menos uma função acadêmica usada pela instância. Confira WebSocket e integrações quando utilizadas.

Não há updater automático. Se a imagem nova falhar, **não** faça apenas rollback do código sobre schema já migrado. Pare os serviços, restaure o backup feito antes da atualização e a imagem/código correspondente; então confira o health. Nunca edite migrations já aplicadas para simular rollback.

## Restauração

A restauração de banco exige App, Admin e realtime **parados**. Não existe restauração online pelo navegador. No host do Compose:

```sh
docker compose -f docker-compose.example.yml stop openstudyhub-web openstudyhub-app openstudyhub-admin openstudyhub-realtime
docker compose -f docker-compose.example.yml run --rm --no-deps openstudyhub-migrate \
  node scripts/restore-manual-backup.mjs /app/data/backups/ARQUIVO.zip \
  --confirm-restore --services-stopped
docker compose -f docker-compose.example.yml up -d
```

Substitua `ARQUIVO.zip` por um backup validado dentro do volume ou copie o ZIP para lá de modo seguro antes da operação. Faça primeiro uma cópia externa dos dados atuais. A ferramenta valida formato, checksums, caminhos e integridade, e guarda arquivos anteriores com sufixo `pre-restore`. Execute as migrations da versão de código que ficará instalada antes de reabrir a instância. Se falhar, preserve os arquivos anteriores e consulte [o procedimento detalhado](operations/manual-backup-restore.md).
