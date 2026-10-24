# Backup e recuperação offline

## Configure a rotina

Em Admin → Sistema → Backup, gere e baixe a chave de recuperação, guarde-a separadamente e confirme que a salvou. Escolha armazenamento local ou local mais Drive central. O segundo exige Drive central autorizado. Ative rotina diária, fuso e retenção quando estiver pronto. Cópias manuais ficam separadas da retenção automática.

Pacotes usam `.oshbackup`, AES-256-GCM e nonce exclusivo. O servidor mantém uma chave protegida para agendamento; a criptografia protege o pacote exportado, não um servidor comprometido. A pasta de controle usa 0700 e a chave 0600. Preserve a chave original: cópias antigas dependem dela.

## Dados incluídos e excluídos

Inclui os dois bancos SQLite, notas/imagens locais, assets privados, anexos de chat e versões locais de projetos, com inventário e checksums. Falta de arquivo local referenciado impede concluir o pacote. Arquivos **somente no Drive ou em outro site não são baixados**. As referências podem continuar no banco sem que os bytes remotos sejam recuperáveis localmente.

Sessões, estados OAuth, inscrições push e refresh tokens Google são removidos das cópias. Conteúdo privado e hashes de senha permanecem. Arquivos de ambiente e segredos de implantação não entram. É preciso configurá-los separadamente e reconectar Google/push. Guarde cópia e chave fora do servidor.

## Consistência, rotina e limites

O snapshot pausa novas operações brevemente enquanto copia os dois bancos e assets geridos de forma consistente. Compressão, criptografia e transferência usam streams depois. Uma trava impede backups simultâneos. O realtime verifica o agendamento a cada minuto; o worker alternativo é `node dist/backup-worker.mjs` na imagem pronta. Use os mesmos caminhos de dados e volume de controle.

O Admin avisa se faltar sinal do worker. A rotina tenta uma vez por dia após o horário; não repete todos os dias perdidos. A retenção remove apenas cópias automáticas concluídas excedentes. Manuais e falhas permanecem. Falha no Drive após sucesso local é indicada como somente cópia local.

Reserve espaço de staging. Limites: 19.997 assets, 1 GiB por arquivo e 4 GiB de assets, sujeitos também ao limite de validação de pacote de 4 GiB. Uploads podem precisar ser reenviados durante o snapshot.

## Valide o pacote criptografado

Use um destino descartável e caminhos dentro do volume montado. Não passe a chave diretamente nos argumentos:

```sh
# Dentro de um container com o volume de recuperação montado em /app/data:
DATABASE_PATH=/app/data/app.db OPENSTUDYHUB_V2_DATABASE_PATH=/app/data/v2.db PRIVATE_ASSET_PATH=/app/data/private-assets node dist/restore-encrypted-backup.mjs /app/data/backup.oshbackup   --key-file /app/data/recovery-key.txt --validate-only
```

Use os nomes reais dos seus arquivos de backup/chave. A validação autentica/descriptografa e confere entradas, caminhos, inventário, checksums, integridade SQLite e chaves estrangeiras. `--validate-only` não substitui dados.

## Aplique a recuperação offline

Pare **App, Admin, realtime e qualquer worker separado**. Faça outra cópia externa dos dados atuais do destino. Execute o mesmo comando com `--confirm-restore --services-stopped` no lugar de `--validate-only`. A ferramenta preserva arquivos anteriores com sufixos de recuperação; só os remova depois de aceitar o resultado. Configure imagem e ambiente correspondentes, execute migrations necessárias, inicie e confira a saúde. Não execute sobre servidor em uso.

A exportação antiga de ZIP sanitizado sem criptografia continua como opção legada. Ela contém dados privados e hashes de senha legíveis e usa `scripts/restore-manual-backup.mjs`; não é intercambiável com `.oshbackup`. Prefira o fluxo criptografado para novas cópias.

## Dados da IA local e da verificação em duas etapas

Desde a 3.1.0, os pacotes também incluem as conversas da IA local, suas fontes e arquivos enviados (`ai/` nos arquivos privados), as configurações da IA com a credencial criptografada do provedor e a verificação em duas etapas dos administradores (segredo do autenticador criptografado e códigos de recuperação em hash). Desafios de login, cadastros pendentes e pedidos de IA em andamento não são levados: os pedidos ficam marcados como interrompidos.

Os valores criptografados só funcionam com a mesma `GOOGLE_TOKEN_ENCRYPTION_KEY`. Se restaurar com outra chave, informe novamente a credencial da IA e redefina a verificação em duas etapas dos administradores afetados com o [comando de recuperação pelo terminal](../admin-mfa.md#perdi-o-autenticador-e-os-codigos).

<!-- Compatibility anchors for previously published guide links. -->

<span id="agendamento"></span>
<span id="aplicar-a-recuperacao-offline"></span>
<span id="backup-e-recuperacao"></span>
<span id="compatibilidade-com-zip-antigo"></span>
<span id="configurar-pelo-admin"></span>
<span id="consistencia-e-consumo"></span>
<span id="o-que-e-recuperavel"></span>
<span id="validar-antes-de-restaurar"></span>
