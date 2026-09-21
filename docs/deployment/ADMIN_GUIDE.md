# Guia do administrador

## 1. Instalação

Veja `docs/getting-started.md` para Node local e `docs/deployment.md` para Docker/produção.

## 2. Primeiro ADMIN

Em banco vazio, abra `/setup` e crie o primeiro administrador. Não reutilize senha institucional.

O setup pode criar o primeiro Program/período/Subject e definir a organização inicial do storage.

## 3. Usuários e contexto acadêmico

Em Administração → Usuários:

- crie contas locais;
- ative/desative usuários;
- atribua Program/Cohort;
- gerencie Enrollments;
- atribua scopes funcionais;
- crie Visual Tags.

Desativar é preferível a hard-delete porque usuários podem possuir histórico, mensagens e documentos.

## 4. Acadêmico

Use Subject + Subject Offering.

Crie Offerings separadas quando turma, professor, período ou Classroom diferirem. Cada usuário é matriculado explicitamente nas Offerings que realmente possui.

## 5. Google

Veja `docs/google.md`.

Cada usuário conecta a própria Conta Google. Classroom usa essa conta pessoal. ADMIN pode designar uma conta conectada como storage owner central do Drive.

## 6. Classroom

Mapping é explícito por Offering.

Quando um Classroom não é visível à conta do administrador, informe Course ID + nome manualmente e deixe o usuário matriculado fazer o sync com a própria conta.

## 7. Drive e Documents

A estrutura central segue Program → Cohort opcional → Período → Disciplina → categoria.

Offerings antigas podem exigir uma ação explícita de recriação/remapeamento da estrutura; o Hub não move arquivos remotos silenciosamente.

Templates podem vir de DOCX importado, Picker ou Google Docs já autorizado.

## 8. Groups e Chat

Group membership controla Group Chat e sharing de Subject Notes/Documents.

Audience Chat usa Program/Cohort. Visual Tags não concedem autorização.

## 9. Projects

Projects são owner-private na V1 e podem ser ocultados em Configurações sem apagar dados.

## 10. Links externos e identidade da instância

Em Configurações → Instância, o ADMIN pode:

- definir o nome da instituição;
- cadastrar vários links externos compartilhados;
- usar esses links para documentação, Drive acadêmico, portal institucional ou outros recursos HTTPS.

O cabeçalho mostra `OpenStudyHub / Instituição` quando um nome institucional está configurado. A pasta raiz criada pelo Drive central usa `Instituição - OSH`.

O antigo campo único de documentação é lido como um link legado e pode ser migrado naturalmente ao cadastrar/remover links no novo gerenciador.

## 11. Backup e manutenção

Veja `docs/backup-update.md`. Preserve banco, private-assets e segredos fora do Git.

## 12. Auditoria

Antes de publicar ou atualizar, use `docs/release-checklist.md` e mantenha o repositório público livre de dados da instância.
