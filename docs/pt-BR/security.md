# Segurança e relato responsável

Mantenha Admin privado, App público com HTTPS, controles de acesso e segredos fora do Git. Não publique bancos, uploads, backups, chaves de recuperação, códigos OAuth, cookies ou IDs reais de Classroom/Drive. Restrinja Docker e host: quem os controla controla a instância.

Use o [relato privado de vulnerabilidade](https://github.com/RichardSpinola/OpenStudyHub/security/advisories/new) quando disponível. Se não estiver, peça um canal privado sem divulgar a falha publicamente. Informe versão, impacto e reprodução mínima sanitizada; não use dados alheios para demonstrar impacto.

A varredura anterior por padrões não encontrou tokens/chaves privadas nos padrões de alta confiança procurados. É uma evidência limitada, não uma auditoria completa nem garantia para todo formato de credencial ou captura. Revise arquivos e imagens antes de publicar.

Backups continuam sensíveis mesmo sanitizados: hashes de senha e conteúdo privado permanecem. A criptografia do pacote exportado não protege servidor comprometido. Veja [backup/recuperação](operations/manual-backup-restore.md).
