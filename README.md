<p align="center">
  <img src="public/brand/openstudyhub-icon.png" alt="OpenStudyHub" width="128" />
</p>

# OpenStudyHub

OpenStudyHub é um workspace acadêmico self-hosted para organizar disciplinas, agenda, Google Classroom, Drive, notas, documentos e colaboração em pequenos grupos.

A aplicação foi pensada para continuar útil sem Google: as integrações são opcionais e o núcleo local usa SQLite.

> Status: primeira versão pública (`v1.0.0`) preparada para release. O projeto possui histórico público limpo, licença AGPL-3.0-only e documentação de instalação e deploy.

## Recursos

- Home personalizável com busca, atalhos e tema claro/escuro.
- Hoje, grade semanal, atividades e disciplinas.
- Programas, turmas, períodos, Subject Offerings e matrículas.
- Google Classroom somente leitura, usando a conta Google de cada usuário.
- Drive acadêmico central opcional, com organização por programa/período/disciplina/categoria.
- Google Docs a partir de modelos, importação DOCX e Google Picker opcional.
- Notas privadas e notas de disciplina compartilháveis explicitamente com Groups.
- Documents privados por padrão, com compartilhamento explícito.
- Chat direto, de Group e por audiência acadêmica.
- Perfis, Visual Tags, notificações internas e notificações do navegador enquanto o Hub está aberto.
- Projects com versionamento de ZIPs, podendo ser ocultado pelo administrador.
- Roles/scopes de ADMIN, MODERATOR e CURATOR.
- Interface TUI-inspired, keyboard-friendly e responsiva.

## Requisitos

- Node.js 24.x
- pnpm 10.x
- Linux/macOS para o caminho de desenvolvimento principal
- Docker opcional para produção

## Desenvolvimento local

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

Abra `http://localhost:3000`. Em uma base vazia, o primeiro acesso redireciona para `/setup`.

Nunca reutilize senha institucional no OpenStudyHub.

## Google opcional

O Core inicia sem configuração Google. Para Drive/Classroom/Docs, uma instância usa um único OAuth app e cada usuário conecta a própria Conta Google.

A configuração usa `drive.file` e scopes Classroom read-only; o projeto não pede acesso geral ao Drive. Consulte [docs/google.md](docs/google.md).

## Docker

Há um exemplo de produção em `docker-compose.example.yml`.

```bash
cp .env.example .env
docker compose -f docker-compose.example.yml up -d --build
```

O container aplica migrations versionadas antes de iniciar a aplicação. Dados persistentes ficam no volume `/app/data`.

Veja [docs/deployment.md](docs/deployment.md) antes de expor a aplicação na internet.

## Qualidade

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Mudanças de schema devem gerar migration versionada:

```bash
pnpm db:generate
pnpm db:migrate
```

## Backup e atualização

Faça backup de `DATABASE_PATH` e `PRIVATE_ASSET_PATH` antes de atualizar. O fluxo manual da V1 está documentado em [docs/backup-update.md](docs/backup-update.md).

O atualizador automático está planejado para uma versão futura.

## Documentação

O conteúdo de `docs/` também pode ser publicado como um site MkDocs/GitHub Pages; a página inicial funciona como landing page do projeto e o restante como documentação navegável.

- [Instalação do zero](docs/instalacao-do-zero.md)
- [Primeiros passos](docs/getting-started.md)
- [Google](docs/google.md)
- [Modelos personalizados](docs/modelos-personalizados.md)
- [Deploy](docs/deployment.md)
- [ZimaOS](docs/zimaos.md)
- [Backup e atualização](docs/backup-update.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Segurança](SECURITY.md)
- [Arquitetura](ARCHITECTURE.md)
- [Contribuição](CONTRIBUTING.md)

## IA no desenvolvimento

Este projeto foi desenvolvido com uso extensivo de ferramentas de IA para implementação, testes, depuração, documentação e revisão. Direção de produto, requisitos, decisões arquiteturais e validação são conduzidos pelo mantenedor.

Veja [AI_USAGE.md](AI_USAGE.md).

## Licença

OpenStudyHub é distribuído sob a **GNU Affero General Public License v3.0 (`AGPL-3.0-only`)**.

Consulte o arquivo [LICENSE](LICENSE) para os termos completos. Modificações disponibilizadas a usuários por meio de uma rede devem oferecer o código-fonte correspondente conforme os termos da AGPL.
