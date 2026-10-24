# Versions and publication status

## 3.1.0

Versioned image: `ghcr.io/richardspinola/openstudyhub:3.1.0`. Adds optional [administrator two-step verification](admin-mfa.md) and an optional [local AI assistant](local-ai.md) for an existing Ollama or OpenAI-compatible server, plus security dependency updates. Two new migrations only create tables; keep the instance encryption key. Read the [release notes](https://github.com/RichardSpinola/OpenStudyHub/releases/tag/v3.1.0) and the [update guide](backup-update.md).

## 3.0.0

Versioned image: `ghcr.io/richardspinola/openstudyhub:3.0.0`. Read the [release notes](https://github.com/RichardSpinola/OpenStudyHub/releases/tag/v3.0.0), [installation guide](instalacao-do-zero.md) or [update guide](backup-update.md).

Current capabilities are described by the guides; version history is not the feature index. Normal upgrades preserve the library and Google configuration. [Update safely](backup-update.md).

## 2.0.1

Fixed trusted-LAN HTTP Admin sessions while preserving HTTPS cookie protections and separate authentication realms.

## 2.0.0

Introduced the canonical academic model, App/Admin separation, optional Google integration and the self-hosted workspace. Older version notes and tags remain in the repository; they do not describe the current interface in full.
