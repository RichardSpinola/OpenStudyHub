# Security and responsible reporting

Keep Admin private, use HTTPS for the public App, preserve access controls and store secrets outside Git. Do not publish databases, uploads, backups, recovery keys, OAuth codes, cookies or real Classroom/Drive IDs. Restrict access to Docker and the host: controlling them controls the instance.

Use the repository's [private vulnerability reporting](https://github.com/RichardSpinola/OpenStudyHub/security/advisories/new) when available. If unavailable, request a private reporting channel without disclosing the vulnerability in a public issue. Include affected version, impact and a minimal sanitized reproduction; never use another person's data to prove impact.

A previous pattern-based history scan found no matching high-confidence token/private-key patterns. That is limited evidence, not a complete security audit or a guarantee that every credential format or screenshot is safe. Review candidate files and images before publication.

Backups remain sensitive even when sanitized; password hashes and private content are still data. Encryption of exported packages does not protect a compromised server. See [backup/recovery](docs/operations/manual-backup-restore.md).

[Português (Brasil)](docs/pt-BR/security.md) · [Full documentation](docs/security.md)

## AI-assisted code

Parts of OpenStudyHub were written with AI assistance ([AI usage](AI_USAGE.md)). That code receives the same review and testing as any other change, and no private data, credentials or user content is shared with AI tools during development. Report vulnerabilities the same way regardless of how the code was produced.
