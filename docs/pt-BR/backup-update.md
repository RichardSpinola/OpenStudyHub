# Atualize sem perder seus dados

## Antes de trocar a versão

1. Leia as notas da versão desejada e confirme que a imagem foi publicada.
2. Crie e baixe um backup em Admin → Sistema → Backup. Guarde a chave de recuperação separada, fora do servidor.
3. Para atualização crítica, pare todos os processos que escrevem e faça também uma cópia externa do volume completo e da configuração privada. Referência da imagem e chave de criptografia fazem parte da recuperação.
4. Preserve nome do projeto Compose e volume. Atualize as imagens dos serviços do aplicativo juntas; mantenha o proxy consistente.
5. Execute migrations, inicie os serviços e confira health, login do Admin, realtime e um fluxo representativo de usuário.

O instalador de primeira instalação **não atualiza** instâncias existentes. Ele recusa um destino em uso. Uma atualização normal não apaga projetos, modelos, notas nem conexões Drive. O reset de Biblioteca feito em uma instância de teste não faz parte da atualização.

## V2 → versão atual

A arquitetura de dois bancos permanece. Novas migrations ampliam os bancos principal e canônico; arquivos de migrations existentes não devem ser editados. Nomes como `v2.db`, `v2-migrations` e `OPENSTUDYHUB_V2_*` são identificadores técnicos compatíveis, não sinal de interface desatualizada.

Preserve assets locais, configuração privada e `GOOGLE_TOKEN_ENCRYPTION_KEY`. Não recrie o Drive central apenas porque a versão mudou. Um restore sanitizado pode exigir reconectar Google, mas uma atualização comum não exige isso por si só.

## Recuperar após falha

Não execute código antigo sobre schema migrado mais novo. Pare App, Admin, realtime e qualquer worker de backup; restaure juntos a cópia anterior dos dados e sua imagem/configuração correspondentes. Confira integridade e saúde antes de reabrir acesso. Investigue falha de migration, sem apagar banco nem forçar a inicialização.

[O guia de recuperação](operations/manual-backup-restore.md) explica pacotes criptografados, validação sem alteração e restore offline. Conteúdo remoto do Drive não entra no backup local. Nunca use `docker compose down -v` como atualização.

## Atualizar para a 3.2.1

A 3.2.1 só muda o layout do espaço de IA e não tem migration. A partir da 3.2.0, troque a imagem e reinicie. Vindo de versões anteriores, as notas da 3.2.0 abaixo também valem.

## Atualizar para a 3.2.0

A 3.2.0 adiciona `drizzle/0024_ai_conversation_model.sql`, duas colunas opcionais que registram o modelo de cada conversa e resposta da IA. Linhas existentes não são reescritas. Uma configuração de IA da 3.1.0 com um modelo continua funcionando e aparece como lista de um modelo; abra **Admin → Assistente de IA** para liberar outros. Nenhuma variável de ambiente nova é obrigatória. Para reverter, restaure a cópia de dados anterior à atualização junto com a imagem 3.1.0.

## Atualizar para a 3.1.0

A 3.1.0 adiciona uma migration no banco principal (`drizzle/0023_local_ai.sql`, tabelas da IA local) e uma no banco canônico (`v2-migrations/0032_admin_mfa.sql`, verificação em duas etapas do administrador). Elas apenas criam tabelas novas; linhas existentes não são reescritas. O serviço de migração as aplica em ordem.

- Mantenha `GOOGLE_TOKEN_ENCRYPTION_KEY` inalterada. Além dos tokens do Google, ela agora protege os segredos dos autenticadores dos administradores e a credencial opcional do provedor de IA.
- A imagem usa Node.js 24.22.1. Nenhuma variável de ambiente nova é obrigatória.
- O assistente de IA continua desativado após a atualização; a verificação em duas etapas fica desligada em todas as contas até que cada administrador a ative.
- Voltar para a 3.0.0 depois dessas migrations exige restaurar a cópia de dados anterior à atualização junto com a imagem 3.0.0. Não execute a 3.0.0 sobre os bancos já migrados.

<!-- Compatibility anchors for previously published guide links. -->

<span id="atualizacao-segura-com-docker-compose"></span>
<span id="backup-atualizacao-e-recuperacao-na-v2"></span>
<span id="backup-manual"></span>
<span id="restauracao"></span>
