# Instalação do zero

Este guia acompanha a primeira instalação, do endereço da instância até o primeiro acesso. Você vai preparar o App para a comunidade e manter o Admin em acesso privado; as integrações Google podem esperar até o espaço acadêmico estar pronto.

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
OPENSTUDYHUB_V2_ENABLED=1
OPENSTUDYHUB_V2_DATABASE_PATH=/app/data/v2.db
PRIVATE_ASSET_PATH=/app/data/private-assets
OPENSTUDYHUB_REALTIME_PUBLIC_URL=wss://hub.exemplo.com/realtime
```

Google pode ficar vazio até o Core estar funcionando.

## 4. Suba a aplicação

O Compose usa a imagem pública fixa `ghcr.io/richardspinola/openstudyhub:2.0.0`; a instalação não exige conta GitHub nem PAT.

```bash
docker compose -f docker-compose.example.yml up -d
```

Confira o App em `http://127.0.0.1:3000` e o Admin local em `http://127.0.0.1:3001/control/login`. Publique somente o App por HTTPS. Confira:

```text
GET /api/health
```

A resposta saudável deve ser HTTP 200.

## 5. Faça o primeiro setup

Abra `/control/setup` na superfície Admin local/LAN. Em um banco V2 vazio, o setup começa pela escolha do idioma da instância, com English selecionado inicialmente.

Crie:

1. escolha do idioma;
2. primeiro Admin;
3. nome da instituição;
4. primeiro curso;
5. período e turma iniciais;
6. detalhes opcionais, revisão e conclusão.

Depois você pode ampliar o modelo acadêmico em Administração. Veja as [capturas fictícias do fluxo inicial](getting-started.md#como-aparecem-as-etapas-iniciais).

## 6. Configure Google do zero

Somente depois que login/Core estiverem saudáveis, siga
[Google: OAuth, Classroom, Drive e Docs](google.md).

A instalação usa um OAuth app por instância. Cada usuário conecta sua própria
Conta Google. A conta central de Drive é escolhida depois entre contas já
conectadas.

## 7. Defina a conta de armazenamento

No Admin → Integrações, escolha uma conta Google já conectada que será dona do armazenamento central.

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
