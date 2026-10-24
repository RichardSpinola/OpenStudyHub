# Security and responsible reporting

Keep Admin private, use HTTPS for the public App, preserve access controls and store secrets outside Git. Do not publish databases, uploads, backups, recovery keys, OAuth codes, cookies or real Classroom/Drive IDs. Restrict access to Docker and the host: controlling them controls the instance.

Use the repository's [private vulnerability reporting](https://github.com/RichardSpinola/OpenStudyHub/security/advisories/new) when available. If unavailable, request a private reporting channel without disclosing the vulnerability in a public issue. Include affected version, impact and a minimal sanitized reproduction; never use another person's data to prove impact.

A previous pattern-based history scan found no matching high-confidence token/private-key patterns. That is limited evidence, not a complete security audit or a guarantee that every credential format or screenshot is safe. Review candidate files and images before publication.

Backups remain sensitive even when sanitized; password hashes and private content are still data. Encryption of exported packages does not protect a compromised server. See [backup/recovery](operations/manual-backup-restore.md).

## Administrator sign-in and local AI

Administrators can enable [two-step verification](admin-mfa.md) for their own Admin account. A full Admin session is created only after the second factor; codes cannot be reused, attempts are limited per challenge and per account, and recovery codes are stored as hashes and work once. Recovery without a code requires terminal access to the server, which is equivalent to controlling the instance.

The [local AI assistant](local-ai.md) is disabled until an administrator tests and enables a provider. It has no tools that act on the Hub, every request re-checks the person's access to the conversation and sources, and provider requests refuse redirects and link-local/cloud metadata addresses. Models can still be wrong or follow injected text in their answers; treat replies as untrusted suggestions.
