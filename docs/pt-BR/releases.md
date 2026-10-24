# Versões e estado da publicação

## 3.1.0

Imagem versionada: `ghcr.io/richardspinola/openstudyhub:3.1.0`. Adiciona [verificação em duas etapas do administrador](admin-mfa.md) opcional e um [assistente de IA local](local-ai.md) opcional para um servidor Ollama ou compatível com OpenAI já existente, além de atualizações de segurança das dependências. Duas migrations novas apenas criam tabelas; preserve a chave de criptografia da instância. Leia as [notas da release](https://github.com/RichardSpinola/OpenStudyHub/releases/tag/v3.1.0) e o [guia de atualização](backup-update.md).

## 3.0.0

Imagem versionada: `ghcr.io/richardspinola/openstudyhub:3.0.0`. Leia as [notas da release](https://github.com/RichardSpinola/OpenStudyHub/releases/tag/v3.0.0), o [guia de instalação](instalacao-do-zero.md) ou o [guia de atualização](backup-update.md).

Os guias descrevem os recursos atuais; histórico não é índice de funcionalidades. Atualizações normais preservam Biblioteca e configuração Google. Veja [atualização segura](backup-update.md).

## 2.0.1

Corrigiu sessões do Admin por HTTP em LAN confiável, preservando proteção dos cookies HTTPS e autenticações separadas.

## 2.0.0

Introduziu modelo acadêmico canônico, separação App/Admin, Google opcional e espaço de estudo auto-hospedado. Notas e tags antigas permanecem no repositório; não descrevem toda a interface atual.
