# Segurança

O OpenStudyHub é self-hosted e ainda passa pelo fechamento da V2. Este documento descreve cuidados de operação e revisão; não afirma uma auditoria independente.

Mantenha o Admin / Control Plane em localhost ou numa rede administrativa protegida. Exponha apenas o App por HTTPS através do proxy configurado, com `/realtime` encaminhado para WebSocket. Bancos SQLite, assets privados, backups, Docker socket e `.env` não devem ser publicados. Não versione dados institucionais reais, IDs privados, chaves, tokens ou sessões.

## Sessões e acesso

O token bruto de sessão fica no cookie `HttpOnly`, com `SameSite=Lax` e `Secure` em produção; o banco guarda apenas o hash. As rotas e ações conferem a sessão e a permissão no servidor. Compartilhamento, salas, projetos, documentos, Admin e Extras exigem autorização própria. Trate uploads, caminhos, ZIPs e URLs externas como entrada não confiável.

## Google

Google é opcional. O OAuth usa authorization code, state de uso único, PKCE S256 e URI de retorno exata. Refresh tokens são criptografados com AES-256-GCM; access tokens são usados nas operações do servidor. Cada usuário autoriza os Classrooms que verá; o Admin não herda esse acesso. Classroom pede escopos de leitura. Drive pede `drive.file` separadamente para arquivos criados ou escolhidos no aplicativo. Guarde `GOOGLE_TOKEN_ENCRYPTION_KEY` fora do Git e não registre códigos, tokens ou segredos em logs. O responsável pelo Drive central não ganha autoridade acadêmica por isso.

## Antes de publicar

O gate final precisa verificar histórico e árvore Git, segredos e dados privados, autorização, OAuth, sessões, uploads e SSRF, migrations, instalação e atualização limpas, backup e restauração, imagem Docker, build e fluxos reais. Consulte [o checklist de release](docs/release-checklist.md). Reporte falhas sem publicar credenciais ou dados pessoais em issues.
