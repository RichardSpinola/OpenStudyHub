<p align="center"><img src="public/brand/openstudyhub-icon.png" alt="OpenStudyHub" width="112" /></p>

# OpenStudyHub

[Português](#o-que-a-v2-oferece) · [English guide](docs/en.md) · [Public site](https://richardspinola.github.io/OpenStudyHub/)

OpenStudyHub reúne aulas, atividades, arquivos e conversas em um espaço que a instituição pode hospedar. A comunidade usa o App no dia a dia; quem administra a instalação usa um Control Plane separado. Você pode começar sem Google e conectar Classroom ou Drive quando fizer sentido. [Read in English](docs/en.md).

O projeto é para quem prefere manter o contexto acadêmico sob seu controle, com disciplinas e turmas organizadas antes de associar serviços externos. Cada pessoa conecta a própria conta para Classroom. O administrador decide se haverá uma conta para armazenamento central no Drive.

## O que a V2 oferece

- **App:** Home personalizável, Hoje, disciplinas e turmas, mural e atividades do Classroom, notas, documentos, projetos com versões, Chat e perfis.
- **Admin / Control Plane:** instalação inicial, instituição, cursos, períodos, disciplinas, matrículas, permissões, integração Google, Extras, manutenção e backup manual.
- **Google:** OAuth individual, descoberta e associação manual de Classrooms, sincronização, Drive/Docs opcional e acompanhamento da saúde da conexão.
- **Extras opcionais:** Quadro Global colaborativo baseado em Excalidraw e cinco jogos locais/privados, controlados pelo Admin.
- **Extensão Chromium e Firefox:** abre a instância escolhida pelo usuário na Nova Aba, sem acesso ao histórico ou ao conteúdo de outros sites.

Uma instalação usa dois bancos SQLite versionados e serviços para App, Admin e colaboração em tempo real. O App pode ser exposto por HTTPS; o Admin fica local/LAN por padrão. Dados persistentes, uploads e segredos ficam fora do repositório.

## Instalação

Requisitos para desenvolvimento: Node.js 24 e pnpm 10. Para instalação com Docker, configure `.env` a partir de [.env.example](.env.example) e siga [Instalação do zero](docs/instalacao-do-zero.md) e [Deploy V2](docs/deployment.md). O exemplo Compose separa App, Admin, realtime e migration; publica o Admin apenas em `127.0.0.1:3001` por padrão. A porta `3000` entrega o App e o realtime pelo proxy local.

O primeiro acesso a uma instalação vazia inicia o setup do administrador. Google pode ser configurado depois. Para o callback V2 e os scopes exatos, veja [Google](docs/google.md).

## Guias

- [Primeiros passos](docs/getting-started.md) e [guia do administrador](docs/deployment/ADMIN_GUIDE.md)
- [Google Classroom, Drive, Docs e OAuth](docs/google.md)
- [Deploy Docker, domínios e superfícies](docs/deployment.md)
- [ZimaOS](docs/zimaos.md), [CasaOS](docs/casaos.md) e [UmbrelOS](docs/umbrelos.md)
- [Backup, atualização e recuperação](docs/backup-update.md)
- [Extensão Nova Aba](docs/extension.md)
- [Licença do projeto e créditos de terceiros](docs/LICENSING.md)

## Desenvolvimento e validação

```sh
cp .env.example .env
pnpm install
pnpm db:migrate
node --env-file=.env scripts/migrate-v2-production.mjs
pnpm dev
```

Antes de iniciar no Node local, ajuste `OPENSTUDYHUB_V2_DATABASE_PATH` no `.env` para um caminho **absoluto** gravável e diferente de `DATABASE_PATH`. Para uma instalação V2 de produção, use migrations V1 e V2 na ordem indicada no Compose. A suíte completa, builds e instalação limpa fazem parte do gate de release; não são substituídos pela execução local de desenvolvimento.

OpenStudyHub é distribuído sob **AGPL-3.0-only**. A extensão e componentes de terceiros preservam seus créditos e licenças. O desenvolvimento contou com ferramentas de IA sob direção do mantenedor; veja [AI_USAGE.md](AI_USAGE.md).
