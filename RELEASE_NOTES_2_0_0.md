# OpenStudyHub v2.0.0 — notas de release

Esta versão reúne o contexto acadêmico, a colaboração e as integrações opcionais em uma instalação self-hosted. A V2 usa dois bancos SQLite e separa o App do Admin / Control Plane; o Admin fica local/LAN por padrão, enquanto o App pode ser publicado com HTTPS.

## Principais recursos

Cursos, períodos, turmas e disciplinas estruturam Hoje, atividades, notas, documentos e projetos. O Chat e o Quadro Global usam colaboração em tempo real. A Home, os temas Material e Legacy/TUI, os perfis, as notificações e os Extras administráveis completam a interface em Português e English. Cada pessoa pode conectar seu Google Classroom em modo somente de leitura; Drive e Google Docs são opcionais. A extensão Nova Aba abre a instância configurada usando a sessão web normal.

## Instalação e atualização

Para instalar, use Docker com Compose e volume persistente `/app/data`, conforme [Instalação do zero](docs/instalacao-do-zero.md) e [Deploy](docs/deployment.md). Para desenvolvimento local, use Node.js 24 e pnpm 10. Configure um `.env` privado a partir de `.env.example`; conclua o primeiro setup na superfície Admin. Exponha apenas o App por HTTPS. A implantação manual por Compose pode ser usada em hosts ZimaOS, CasaOS e UmbrelOS que ofereçam esse recurso; não há pacote nativo de loja.

Antes de atualizar, crie e baixe um [backup](docs/backup-update.md), preserve uma cópia externa do volume e do `.env` e confira a compatibilidade dos dados. Migrations V1 e V2 são executadas na ordem definida pelo Compose. Não execute código antigo contra um banco já migrado. A restauração requer App, Admin e realtime parados; usuários fazem login novamente e reconectam o Google depois dela.

## Mudanças em relação à V1

A V2 introduz estrutura acadêmica e banco próprios, setup inicial, duas superfícies, colaboração e recursos opcionais administráveis. A existência de um banco V1 não implica importação automática de dados reais: planeje e valide a migração separadamente, com backup anterior.

## Google e limites conhecidos

Google exige credenciais OAuth da própria instalação, callback `APP_URL + /api/v2/google/callback` e os scopes documentados em [Google](docs/google.md). Classroom é pessoal e somente de leitura; a associação às disciplinas é confirmada pelo usuário. Conteúdo remoto do Drive não entra no backup local. A extensão Firefox precisa de assinatura para instalação permanente. O ZIP da extensão acompanha a GitHub Release; a imagem pública versionada é `ghcr.io/richardspinola/openstudyhub:2.0.0`. As lojas Chrome Web Store e Firefox Add-ons não fazem parte desta publicação.

Licença e créditos: [LICENSING.md](docs/LICENSING.md). Guia em inglês: [en.md](docs/en.md).
