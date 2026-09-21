# Segurança

OpenStudyHub é um projeto self-hosted em estágio inicial. A V1 deve passar por uma auditoria final antes da primeira publicação pública, mas isso não equivale a uma auditoria profissional independente.

## Modelo de ameaça básico

Assumimos que computadores de faculdade podem ser compartilhados, a rede local/campus não é uma fronteira confiável, uploads são entrada não confiável e tokens OAuth são sensíveis.

## Regras

1. Nunca armazene senha institucional.
2. Nunca versione `.env`, banco SQLite, tokens, chaves, IDs privados ou conteúdo acadêmico real.
3. Nunca exponha Docker socket para a aplicação.
4. Não exponha SQLite como serviço de rede.
5. Valide uploads, caminhos e URLs.
6. Use autorização server-side e default-deny para ações administrativas.
7. Mantenha scopes Google mínimos.
8. Não registre segredos em logs.

## Sessões

O token bruto de sessão fica apenas no cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. SQLite guarda somente o hash do token.

## Google OAuth

Google é opcional. A integração usa authorization-code flow, state one-time, PKCE S256, redirect URI exata, refresh token criptografado com AES-256-GCM e access token apenas durante a operação server-side.

Scopes da V1 são limitados a identidade, `drive.file` e Classroom read-only necessários às funções implementadas.

## Drive central

O storage owner central é uma credencial de armazenamento, não uma autoridade acadêmica. Ações continuam exigindo autorização do ator dentro do Hub. O sistema não deve criar links `anyone` ou permissões de domínio para contornar falta de acesso.

## Sharing e Chat

- Private Notes permanecem owner-only.
- Subject Notes/Documents só são compartilhados explicitamente.
- Group membership é verificada no servidor.
- Audience Chat deriva acesso do contexto acadêmico atual.
- anexos são privados e exigem acesso à sala.

## Uploads e fetch remoto

Validações relevantes incluem imagens decodificadas de fato, limite de tamanho, arquivos privados, DOCX como OOXML, ZIPs de Projects protegidos contra traversal/symlinks/bombas e favicon discovery com proteção SSRF também em redirects.

## Produção

Use HTTPS e um reverse proxy em frente ao servidor Next.js. Não publique diretamente banco ou diretórios privados. `DATABASE_PATH` e `PRIVATE_ASSET_PATH` precisam de armazenamento persistente.

## Antes do primeiro release público

A auditoria final deve verificar histórico Git, segredos/dados privados, OAuth/tokens, cookies/sessões, autorização de Groups/Chat/sharing, uploads/SSRF, headers, migrations clean + upgrade, build de produção, imagem Docker e backup/restore.
