# Local AI assistant

The assistant is optional and **disabled by default**. It answers study questions using a model server that you already run: OpenStudyHub does not install an inference server, download models, pick a model for you or require a cloud subscription. People only see it after an administrator connects, tests and enables a model.

## Requirements

- An existing **Ollama** server, or a server that implements the OpenAI-compatible **Chat Completions** API (`/v1/models` and streaming `/v1/chat/completions`).
- A model already installed on that server. Pick one that fits the server's memory; the Hub only lists what the provider reports.
- Network access from the Hub containers to the provider. In Docker, `127.0.0.1` is the Hub container itself; use the provider's LAN address or a Docker network name.
- The instance encryption key (`GOOGLE_TOKEN_ENCRYPTION_KEY`) must be configured. It also encrypts the optional provider credential.

Expect modest speed on CPU-only hardware. During 3.1.0 validation, a 1B-parameter model on a four-core server without a GPU produced roughly 10–15 tokens per second: short answers arrive in a few seconds, while a long essay can reach the default 120-second limit and is then kept as an interrupted partial reply. Small models also make factual mistakes; treat answers as study help to check, not as an authority.

## Connect and enable

In **Admin → AI assistant**:

1. Choose the provider and its base address, for example `http://192.168.1.20:11434` for Ollama. For a compatible server you may include `/v1`; the Hub adds the fixed API paths.
2. Enter a credential only if the provider requires one. It is encrypted with the instance key and never sent to the browser. Leaving the field blank keeps a saved credential; the removal control deletes it.
3. Select **Test connection and list models**. The models installed on the provider appear under **Models**: tick up to eight that people may use, choose the default model and the models used by @IA in the global chat and in study groups, then test again (every ticked model is checked). This explicit administrator action contacts the provider even while the assistant is disabled. **A test saves the provider settings and leaves the assistant disabled**, so enable and save again afterwards.
4. Enable image input only if the model supports it. For Ollama the Hub checks the model's reported capabilities; compatible servers have no standard capability field, so confirm support in the model documentation.
5. Set instructions, limits and permissions, enable and save. Changing provider settings or disabling the assistant interrupts running replies and keeps existing history.

For Ollama, the Hub requests answers with the model's separate "thinking" mode turned off. Reasoning models otherwise spend the output budget and timeout on hidden reasoning before any visible text. Compatible servers receive a standard request; reasoning output that such a server sends separately is not shown.

The browser only talks to the Hub. For each provider request the server pins the resolved address, refuses redirects and blocks link-local/cloud metadata addresses. Private and loopback addresses are allowed, because local AI usually lives there. Do not expose an inference server to the internet without its own authentication and network controls.

### Models and server memory

People pick one of the allowed models in the conversation header; the choice is kept per conversation, and replies show which model wrote them. A model that the administrator did not allow is refused by the server. Image attachments are accepted only when the chosen model reports image support.

For Ollama, **AI server memory** shows which allowed models are loaded and how much memory they use, with **Load now** and **Unload** buttons. **Unload after** sets how long a model stays in memory after its last use (default 10 minutes, `-1` keeps it loaded, `0` unloads right after each reply). Loading takes a few seconds on a CPU server; keeping a model loaded speeds up the first reply at the cost of RAM.

## Limits and permissions

| Setting               | Default            | Meaning                                                                                |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| Context / max output  | 8192 / 2048 tokens | Context sent to the model and maximum reply length. Output must leave room for input.  |
| Timeout               | 120 s              | Per reply. A reply that exceeds it is stored as interrupted, with the partial text.    |
| Concurrent / queue    | 1 / 8              | Instance-wide. When the queue is full, people are asked to try again shortly.          |
| Daily quota           | 0                  | Requests per person per UTC day; `0` means no quota (technical limits still apply).    |
| Groups / global @IA   | off / off          | Group conversations and copies; separately, @IA in the instance-wide global chat room. |
| Hub sources / uploads | on / on            | Whether people may pick notes, documents, projects and materials, or attach files.     |

The assistant has no tools: it cannot edit, delete, share or run anything in the Hub, and it never executes uploaded files or code. Documents, chat history and uploads are passed to the model as quoted, untrusted data with an instruction not to follow commands inside them. A model can still produce wrong or misleading text, so the protection is that the assistant has nothing it can act on, not that the model always obeys.

## Using the assistant

Open **Extras → AI assistant**, or the assistant entry in **Chat**. Conversations are private to your account: create, rename, search and delete them. Replies stream into the conversation; **Stop** cancels yours. Interrupted or failed replies keep their partial text and are marked as such. If the browser loses the stream, reopen the conversation.

### Sources and attachments

Sources are chosen explicitly; the assistant does not browse your library or follow links. You can pick notes you own or that are shared with you, generated and local documents, text files from projects and cached Classroom materials. Each source is labelled `[S1]`, `[S2]` and so on, and the model is asked to cite those labels.

Uploads per message: up to **four files of 10 MB** each.

- PDF (at most 50 pages), DOCX, UTF-8 TXT and Markdown.
- Static PNG, JPEG and WebP only when image input is enabled for a vision model.
- Extracted text is capped at 50,000 characters per message and reduced further to fit the configured context; the interface warns when content was reduced. Long history is shortened from the oldest messages.
- PDF, DOCX and images are parsed in a separate process with memory and time limits.

### Sharing a copy with a study group

**Share a copy** shows how many messages and attachments will be shared and asks for confirmation. The copy belongs to the chosen existing study group; your private original stays separate and deleting it does not remove the copy. Every note, document or project used as a source must already be shared with that group, otherwise sharing is refused. Private Classroom material caches cannot be shared with a group.

Members of the group can read the copy, download its attachments and continue it. Access is checked on every read, send, stream and download: a person removed from the group, or who loses access to a source, loses access immediately. Only the person who asked a question can stop that reply.

## @IA in chat

Two switches are needed: the administrator allows group AI (and, separately, @IA in the global room), and the owner of each study group enables **Allow @IA in this group**. Other members cannot change it.

The assistant answers only when a person writes `@IA` as a word. Ordinary messages, addresses such as `ia@example.com`, words such as `@IAgo` and the assistant's own replies never start a generation, so replies cannot trigger each other. The assistant answers only the message that mentions it, briefly; the previous few room messages are used only as background, and it is instructed not to comment on other people's messages. Direct conversations and other rooms are never read. Type `@` to see **@IA** in the mention suggestions; the hint about @IA under the room header appears once per browser and then hides. Replies are formatted (lists, bold, code), and output that starts repeating itself is stopped and kept as an interrupted reply. Replies have their own visible authorship and are stored separately from human messages. If @IA is not allowed in a room, a mention is sent as an ordinary message and no reply is generated.

## Backups and storage

Conversation history and sources live in the instance database; uploaded files live in the private asset directory under `ai/`. Both are included in managed backups and restored with them. The provider credential is stored encrypted: restore it with the same instance encryption key, or enter it again. Active requests are marked as interrupted in exported snapshots and after a restart.

## Troubleshooting

| Symptom                                     | What to check                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Test fails with "Unable to save or connect" | Address reachable from the Hub container (not `127.0.0.1`), provider running, model name exact, credential.    |
| The assistant switched itself off           | A connection test saves settings with the assistant disabled. Enable and save again.                           |
| Replies end as interrupted                  | Timeout too short for the hardware or a very long request. Raise the timeout or ask for shorter answers.       |
| "The queue is full"                         | Raise the queue or concurrency only if the provider has spare memory and CPU.                                  |
| Image attachments refused                   | Image input disabled, or the model does not report vision support.                                             |
| @IA does not answer in a group              | Group AI allowed in Admin, the group owner enabled @IA, quota and queue available, the word `@IA` is separate. |
