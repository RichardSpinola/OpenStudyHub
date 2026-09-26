# Backup e restauração manual

O Admin local em **Sistema → Backup manual** cria um ZIP com snapshots SQLite consistentes dos bancos principal e V2, mais os assets privados locais. O download exige a sessão própria do Admin. Cada ZIP fica no diretório privado `backups` ao lado do banco V2. O backup remove sessões, estados OAuth, inscrições push e refresh tokens das cópias; após restaurar, todos precisam entrar novamente e reconectar o Google. O ZIP ainda contém dados privados e hashes de senha, portanto guarde-o em armazenamento protegido. IDs e conteúdo remotos do Google Drive não são copiados.

Para restaurar, pare **App, Admin e realtime** e tenha um backup externo dos dados atuais. Execute a ferramenta local dentro do ambiente da instalação, apontando apenas para os dois bancos e a pasta privada da instalação a ser restaurada:

```sh
DATABASE_PATH=/app/data/openstudyhub.db \
OPENSTUDYHUB_V2_DATABASE_PATH=/app/data/v2.db \
PRIVATE_ASSET_PATH=/app/data/private-assets \
node scripts/restore-manual-backup.mjs /app/data/backups/ARQUIVO.zip --confirm-restore --services-stopped
```

A ferramenta recusa arquivos desconhecidos, caminhos inseguros, links simbólicos, checksums divergentes e bancos que falhem em `integrity_check` ou `foreign_key_check`. Ela valida antes de substituir dados e preserva a instalação anterior em arquivos `*.pre-restore-<data>`. Execute migrations da versão instalada antes de reiniciar. Confira o diagnóstico do Admin após subir os serviços. Se ocorrer erro, não apague as cópias anteriores.

Os dois bancos são capturados em sequência; durante tráfego ativo, alterações cruzadas entre eles podem acontecer entre snapshots. Para migração crítica ou troca de instalação, faça o backup em janela de manutenção com escritas pausadas. A restauração via navegador não é oferecida.
