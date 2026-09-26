# Troubleshooting

## `/api/health` retorna 503

Verifique:

- `DATABASE_PATH` existe e é gravável;
- `OPENSTUDYHUB_V2_DATABASE_PATH` é absoluto, gravável e aponta para outro banco;
- volume persistente está montado;
- migrations foram aplicadas;
- processo/container possui permissão sobre `data/`.

## Google aparece como não configurado

Confirme:

- `GOOGLE_CLIENT_ID`;
- `GOOGLE_CLIENT_SECRET`;
- `GOOGLE_REDIRECT_URI`;
- `GOOGLE_TOKEN_ENCRYPTION_KEY`.

Reinicie a aplicação após alterar env.

## OAuth volta com erro de redirect

A URI cadastrada no Google Cloud deve coincidir exatamente com `GOOGLE_REDIRECT_URI`, usando `/api/v2/google/callback`.

Em produção use HTTPS.

## Google Doc-base dá acesso negado

`drive.file` não concede acesso só porque o usuário colou a URL de qualquer Doc existente.

Use uma destas opções:

- importar DOCX pelo Hub;
- Google Picker configurado;
- arquivo previamente criado/autorizado pelo OpenStudyHub.

## Documento central aparece com autorização pendente

O arquivo pode ter sido criado corretamente no Drive central, mas a permissão individual Google ainda não foi concedida. O compartilhamento interno do Hub e a permissão no Google são camadas separadas.

## Classroom de outro aluno não aparece para ADMIN

Mapeie a Offering manualmente por Course ID + nome. O aluno sincroniza depois com a própria Conta Google.

## Notificação do sistema não aparece com o browser fechado

Confirme permissão de notificação no navegador, HTTPS (ou localhost), configuração de push da instância e registro do navegador. Um navegador ou sistema pode restringir entrega em segundo plano; confira também as notificações internas no App.

## Favicon não aparece

O Hub tenta descobrir/cachear um ícone seguro. Alguns sites bloqueiam fetch ou não fornecem um formato utilizável. O fallback é o monograma do atalho.

## Projects sumiu

ADMIN pode desativar a feature em Configurações. Isso não apaga Projects existentes; reative para restaurar a UI.
