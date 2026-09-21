# Instalação do zero

Este roteiro é o caminho recomendado para validar uma instalação nova como se
você fosse um usuário chegando ao projeto pelo GitHub.

## 1. Escolha o endereço público

Defina primeiro onde a instância será acessada, por exemplo:

```text
https://hub.exemplo.com
```

Produção deve usar HTTPS. O endereço será usado por `APP_URL` e pelo callback
OAuth do Google.

## 2. Prepare os dados persistentes

No Docker, persista `/app/data`. É ali que ficam SQLite e private-assets.

Nunca coloque em Git:

- `.env`;
- banco SQLite/WAL/SHM;
- tokens;
- uploads;
- IDs privados de Classroom/Drive;
- backups.

## 3. Crie o `.env`

Comece com:

```bash
cp .env.example .env
```

Para produção, ajuste pelo menos:

```env
NODE_ENV=production
APP_NAME=OpenStudyHub
APP_URL=https://hub.exemplo.com
DATABASE_PATH=/app/data/openstudyhub.db
PRIVATE_ASSET_PATH=/app/data/private-assets
```

Google pode ficar vazio até o Core estar funcionando.

## 4. Suba a aplicação

```bash
docker compose -f docker-compose.example.yml up -d --build
```

Confira:

```text
GET /api/health
```

A resposta saudável deve ser HTTP 200.

## 5. Faça o primeiro setup

Abra a instância no navegador. Em um banco vazio você será levado a `/setup`.

Crie:

1. primeiro ADMIN;
2. nome da instituição;
3. primeiro Program;
4. turma opcional;
5. período atual;
6. primeira disciplina.

Depois você pode ampliar o modelo acadêmico em Administração.

## 6. Configure Google do zero

Somente depois que login/Core estiverem saudáveis, siga
[Google: OAuth, Classroom, Drive e Docs](google.md).

A instalação usa um OAuth app por instância. Cada usuário conecta sua própria
Conta Google. A conta central de Drive é escolhida depois entre contas já
conectadas.

## 7. Defina a conta de armazenamento

Em Configurações, escolha a Conta Google que será dona do armazenamento central.

A pasta raiz é nomeada a partir da instituição:

```text
Nome da Instituição - OSH/
```

Classroom continua usando a conta pessoal do aluno.

## 8. Cadastre usuários e Offerings

Não assuma que todos do mesmo Program possuem as mesmas matérias.

Use:

```text
Subject
  -> Subject Offering
      -> Enrollment
```

Turma/professor/Classroom diferente deve ser uma Offering diferente.

## 9. Teste antes de colocar dados reais

Faça um smoke test:

- login/logout;
- Home;
- Chat;
- Note privada;
- Note compartilhada;
- modelo DOCX;
- geração de documento;
- pasta correta no Drive;
- sync Classroom, se disponível;
- backup.

## 10. Backup inicial

Depois que a configuração estiver boa, faça o primeiro backup do diretório
persistente e guarde uma cópia segura do `.env`, especialmente da chave de
criptografia dos tokens Google.
