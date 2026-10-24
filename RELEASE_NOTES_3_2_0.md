# OpenStudyHub 3.2.0

A usability update focused on phones and the local AI assistant. Use the pinned `ghcr.io/richardspinola/openstudyhub:3.2.0` image and follow the update guide for an existing instance.

## Phones

- A bottom tab bar with Home, Today, Subjects, Notes and Chat, plus Library and Extras under **More**, replaces the "Areas" dropdown on screens up to 780px.
- A compact one-row header with larger touch targets, consistent dynamic viewport height and a single phone breakpoint shared with Chat.
- Page fixes for the Today day picker, single-column Subjects and Library, wide note databases and settings rows with selects.
- Both the Material and Legacy (terminal) themes are covered.

## Local AI assistant

- **Several models.** After **Test connection**, administrators tick up to eight installed models, choose the default and the models used by @IA in the global chat and in study groups. People choose a model per conversation; replies show which model answered.
- **Server memory (Ollama).** See which models are loaded and their memory use, load or unload them, and set how long an idle model stays in memory (default 10 minutes, or keep loaded).
- **Better answers.** @IA now answers only the message that mentions it, with earlier room messages as background only. Hidden reasoning is disabled, repetition is penalised and runaway output is stopped. Replies render lists, bold text and code.
- **@IA in mentions.** Typing `@` suggests **@IA** with a robot icon; the @IA hint appears once per browser.
- **New look.** A preview on the Extras card; a full-screen workspace with suggested prompts, a model selector, source pills, assistant identity and a conversation drawer on phones. Untitled conversations are named after their first question. With a wallpaper behind the App, the assistant panels and the phone tab bar use the same frosted glass as the header.

## Project

- AI-assisted development is now documented in the README, CONTRIBUTING, SECURITY and licensing guide, naming the tools used: GPT 5.6 Sol, GPT 6.0 Sol, GPT 6.1 Sol and Claude Opus 5.5.

## Updating

One new main-database migration (`drizzle/0024_ai_conversation_model.sql`) adds two nullable columns; existing rows are not rewritten. A 3.1.0 single-model AI configuration is read as a one-model list and stays enabled. Keep both databases, private assets, environment and `GOOGLE_TOKEN_ENCRYPTION_KEY`. A rollback to 3.1.0 requires restoring the matching pre-update data with the 3.1.0 image. [Update guide](docs/backup-update.md).

Previous notes: [3.1.0](RELEASE_NOTES_3_1_0.md), [3.0.0](RELEASE_NOTES_3_0_0.md), [2.0.1](RELEASE_NOTES_2_0_1.md), [2.0.0](RELEASE_NOTES_2_0_0.md).
