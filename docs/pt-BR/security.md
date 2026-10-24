# Segurança e relato responsável

Mantenha Admin privado, App público com HTTPS, controles de acesso e segredos fora do Git. Não publique bancos, uploads, backups, chaves de recuperação, códigos OAuth, cookies ou IDs reais de Classroom/Drive. Restrinja Docker e host: quem os controla controla a instância.

Use o [relato privado de vulnerabilidade](https://github.com/RichardSpinola/OpenStudyHub/security/advisories/new) quando disponível. Se não estiver, peça um canal privado sem divulgar a falha publicamente. Informe versão, impacto e reprodução mínima sanitizada; não use dados alheios para demonstrar impacto.

A varredura anterior por padrões não encontrou tokens/chaves privadas nos padrões de alta confiança procurados. É uma evidência limitada, não uma auditoria completa nem garantia para todo formato de credencial ou captura. Revise arquivos e imagens antes de publicar.

Backups continuam sensíveis mesmo sanitizados: hashes de senha e conteúdo privado permanecem. A criptografia do pacote exportado não protege servidor comprometido. Veja [backup/recuperação](operations/manual-backup-restore.md).

## Login de administradores e IA local

Administradores podem ativar a [verificação em duas etapas](admin-mfa.md) na própria conta do Admin. Uma sessão completa do Admin só é criada depois do segundo fator; códigos não podem ser reutilizados, as tentativas são limitadas por desafio e por conta, e os códigos de recuperação ficam em hash e valem uma vez. Recuperar sem código exige acesso ao terminal do servidor, o que equivale a controlar a instância.

O [assistente de IA local](local-ai.md) fica desativado até que um administrador teste e ative um provedor. Ele não tem ferramentas que atuem no Hub, cada pedido confere novamente o acesso da pessoa à conversa e às fontes, e as requisições ao provedor recusam redirecionamentos e endereços link-local/de metadados de nuvem. Ainda assim, modelos podem errar ou reproduzir texto injetado nas respostas; trate as respostas como sugestões não confiáveis.
