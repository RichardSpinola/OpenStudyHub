# Checklist de release pública

Não faça o primeiro push público antes de concluir todos os itens críticos.

## Código e dados

- [ ] `git status` limpo.
- [ ] nenhum `.env`, banco, WAL/SHM, token, cookie, ID privado ou upload real.
- [ ] histórico público não contém `AGENTS.md` privado nem dados removidos posteriormente.
- [ ] licença escolhida e `LICENSE` preenchido.

## Validação

- [ ] format.
- [ ] lint sem warnings.
- [ ] typecheck.
- [ ] testes completos.
- [ ] build de produção.
- [ ] `db:generate` sem delta inesperado.
- [ ] clean install das migrations.
- [ ] upgrade de banco temporário representativo.
- [ ] foreign key/integrity checks.
- [ ] `/api/health` 200.
- [ ] build e health do Docker.

## Segurança

- [ ] cookies/sessões revisados.
- [ ] OAuth/tokens revisados.
- [ ] autorização server-side revisada.
- [ ] Groups/Chat/Notes/Documents revisados.
- [ ] uploads/ZIP/DOCX/imagens revisados.
- [ ] SSRF de favicons revisado.
- [ ] headers de segurança revisados.
- [ ] logs não contêm segredo.

## Smoke test humano

- [ ] setup/login/logout.
- [ ] Home/Hoje/Disciplinas.
- [ ] Chat básico.
- [ ] Notes privadas e sharing.
- [ ] Documents.
- [ ] Google opcional, se configurado.
- [ ] backup restaurável.

## Publicação do site

- [ ] `mkdocs build --strict` passa.
- [ ] GitHub Pages habilitado para GitHub Actions.
- [ ] landing page e navegação da documentação abrem corretamente.
- [ ] favicon/logo da documentação carregam.
- [ ] links públicos não apontam para localhost.
