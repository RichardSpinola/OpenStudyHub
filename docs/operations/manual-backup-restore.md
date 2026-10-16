# Backup e recuperação

## Configurar pelo Admin

Em **Sistema → Backup**:

1. Gere e baixe a chave de recuperação. Guarde-a fora deste servidor e separada das cópias. Confirme que a guardou; a chave não volta a ser exibida.
2. Escolha **Neste servidor** ou **Neste servidor e no Drive central**. O segundo destino exige a conta responsável conectada e a pasta central configurada.
3. Ative a rotina diária, escolha horário/fuso e retenção. Sugestão: **03:00 / America/Bahia / 7 cópias automáticas válidas**. A rotina começa desligada.
4. Use **Criar backup agora** para uma cópia manual. Cópias manuais não entram na limpeza automática.

Os pacotes `.oshbackup` usam AES-256-GCM com chave aleatória de 256 bits e nonce exclusivo por pacote. O servidor guarda uma cópia da chave em `backup-control/recovery.key`, ao lado do banco V2, com permissão `0600`; a pasta tem `0700`. Isso permite o agendamento. Proteção contra perda do servidor depende de guardar a chave e uma cópia fora dele. Quem controla o servidor também controla a chave; esta criptografia protege o pacote exportado, não um servidor comprometido.

Os pacotes ficam na pasta privada `backups`, ao lado do banco V2. O download exige sessão do Admin sem troca de senha pendente. A chave não aparece em URLs, auditoria ou propriedades da página. Não edite nem substitua a chave de uma instância em uso: cópias antigas dependem da chave original.

## O que é recuperável

Inclui os dois bancos, notas/páginas/bases, imagens das notas e wallpapers de chat guardados nos bancos, imagens privadas, anexos binários do chat, arquivos de storage local e versões ZIP locais dos projetos. Um inventário com SHA-256 acompanha o pacote. Uma referência local sem arquivo impede concluir o backup.

**Arquivos existentes apenas no Google Drive ou em outros sites NÃO são baixados para o pacote.** O manifesto distingue arquivos geridos copiados de referências remotas não copiadas. Referências continuam no banco, mas recuperação remota depende do serviço e da conta originais. Não é um espelho do Drive.

Sessões, estados OAuth, inscrições push e refresh tokens são removidos da cópia. Hashes de senha e conteúdo privado continuam presentes. O arquivo de ambiente, secrets e as chaves VAPID não entram no pacote; configure-os separadamente e reconecte Google/push depois da recuperação. Isso evita portar sessões ou declarar que uma integração externa foi recuperada apenas porque seu ID existe.

## Consistência e consumo

Durante o snapshot, App/Admin/realtime pausam novas operações com resposta temporária. Dois bloqueios SQLite de escrita mantêm os bancos estáveis enquanto os snapshots e arquivos locais são preparados. Depois a edição é liberada; compressão, criptografia e cópia ao Drive usam streams. Um bloqueio SQLite separado impede dois backups simultâneos, inclusive entre processos. Se o processo cair, o bloqueio é liberado pelo sistema; a próxima execução assume a rotina. Uploads em andamento podem falhar temporariamente e devem ser reenviados.

Limites: 19.997 assets, 1 GiB por arquivo e 4 GiB de assets, além do limite de validação do pacote de 4 GiB no total. Reserve espaço para staging, ZIP temporário e pacote criptografado. Falha de disco/arquivo não substitui a última cópia válida. Se o Drive falhar após concluir a cópia local, o histórico mostra **Somente cópia local**, sem declarar sucesso nos dois destinos. Cópias parciais são mantidas para revisão; verifique espaço e remova-as manualmente após recuperar o destino.

A retenção remove apenas cópias automáticas concluídas além da quantidade configurada; manuais e falhas não são removidas. No Drive, só são removidos IDs de cópias criadas e registrados por esta instância. Não há limpeza de arquivos arbitrários da pasta central.

## Agendamento

O serviço realtime verifica a rotina a cada minuto. Para instalações sem realtime, execute um único worker alternativo:

```sh
node --import tsx scripts/backup-worker.ts
# Imagem construída da V3:
node dist/backup-worker.mjs
```

App/worker precisam compartilhar os mesmos caminhos de dados e volume de controle. A trava impede execução duplicada mesmo se dois workers estiverem ativos. A tela avisa se não houver sinal do worker há três minutos. A rotina tenta uma vez por dia após o horário, inclusive ao iniciar tarde; falhas ficam no histórico para intervenção. Não executa vários backups atrasados de dias anteriores. Retenção e fuso são configuráveis; mudanças não apagam o histórico de execução.

## Validar antes de restaurar

Use uma instalação/pasta de teste, com espaço disponível. Nunca passe a chave diretamente na linha de comando. O arquivo baixado da tela é aceito pela ferramenta.

```sh
DATABASE_PATH=/teste/app.db \
OPENSTUDYHUB_V2_DATABASE_PATH=/teste/v2.db \
PRIVATE_ASSET_PATH=/teste/private-assets \
node --import tsx scripts/restore-encrypted-backup.ts /seguro/backup.oshbackup \
  --key-file /seguro/openstudyhub-recovery-key.txt --validate-only
```

Na imagem construída da V3, use `node dist/restore-encrypted-backup.mjs` no lugar de `node --import tsx scripts/restore-encrypted-backup.ts`.

A validação autentica/descriptografa o pacote, recusa caminhos inseguros, links simbólicos, entradas duplicadas, inventário divergente, checksums incorretos e bancos que falhem em `integrity_check` ou `foreign_key_check`. `--validate-only` não substitui nenhum dado.

## Aplicar a recuperação offline

Pare **App, Admin, realtime e qualquer worker de backup**. Configure os três caminhos da instalação de destino e execute a mesma ferramenta trocando `--validate-only` por:

```sh
--confirm-restore --services-stopped
```

A ferramenta valida tudo antes de substituir dados e preserva a instalação anterior, incluindo WAL/SHM, em `*.pre-restore-<data>`. Se a instalação falhar no meio, reverte os caminhos já movidos. Não restaure com serviços ativos: a confirmação é uma exigência operacional, não um detector de todos os processos possíveis.

Depois execute as migrations da versão instalada, configure o ambiente, confira o Admin e só então reabra o App. Todos precisam entrar novamente; reconecte Google e dispositivos push. Revise destino e agenda de backup. Preserve as cópias anteriores até concluir sua conferência.

## Compatibilidade com ZIP antigo

A opção **Exportação antiga sem criptografia** continua separada no Admin. Ela sanitiza credenciais, mas contém dados privados e hashes de senha. Proteja o ZIP. Para validar/restaurar os arquivos antigos:

```sh
node scripts/restore-manual-backup.mjs /seguro/backup.zip --validate-only
# Com serviços parados e os três caminhos de ambiente definidos:
node scripts/restore-manual-backup.mjs /seguro/backup.zip --confirm-restore --services-stopped
```

Google/Drive real, secrets do servidor e troca da instalação de produção permanecem reservados ao ensaio autorizado da etapa 8.
