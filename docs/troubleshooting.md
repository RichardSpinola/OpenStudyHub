# Troubleshooting

| Symptom                          | Check first                                                             | Next step                                                            |
| -------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Installer cannot find Docker     | Docker installed/running and account access                             | Follow the host's Docker guide; the script does not install it       |
| Public 3.0.0 image unavailable   | Release publication status and exact tag                                | Wait for publication or use an explicitly trusted local image        |
| Directory/project already exists | Correct installation target                                             | Use the update guide; do not erase the volume                        |
| Port occupied                    | Another process or instance                                             | Choose a different port and rerun before installation                |
| App health 503                   | Migration success, writable distinct database paths, volume permissions | Inspect private service logs; never delete the database to repair it |
| Health 200 but realtime degraded | Internal realtime health and proxy routes                               | Check `/realtime` and `/whiteboard` WebSocket forwarding             |
| Google not configured            | Client ID/secret, callback and encryption key                           | Configure privately and restart App/Admin                            |
| `redirect_uri_mismatch`          | Exact public origin, port and callback path                             | Correct the registered `/api/v2/google/callback` URI                 |
| Classroom materials missing      | User association, material tab and last sync                            | Reconnect/sync; announcements and coursework are not materials       |
| Drive file refused               | `drive.file` authorization and owning OAuth client                      | Import/authorize correctly or manage the file in Drive               |
| Backup routine not running       | Enabled schedule and worker heartbeat                                   | Keep realtime or one alternative worker active                       |
| Note not saved                   | Server acknowledgement and browser draft warning                        | Download the recovery draft; do not clear browser storage            |

## Share a useful report

Include the running version, affected screen, steps, expected/actual result and a sanitized screenshot. Share only relevant log excerpts after removing tokens, cookies, codes, emails and private file IDs. Do not attach `.env`, databases, backups or recovery keys.

For installer-managed deployments, `bash scripts/install-server.sh --diagnose --directory YOUR_DIRECTORY` is read-only. Raw `install.log` and plain Compose configuration are private. For recovery, use the [offline procedure](operations/manual-backup-restore.md), not improvised SQL changes.

<!-- Compatibility anchors for previously published guide links. -->

<span id="apihealth-retorna-503"></span>
<span id="classroom-de-outro-aluno-nao-aparece-para-admin"></span>
<span id="documento-central-aparece-com-autorizacao-pendente"></span>
<span id="favicon-nao-aparece"></span>
<span id="google-aparece-como-nao-configurado"></span>
<span id="google-doc-base-da-acesso-negado"></span>
<span id="notificacao-do-sistema-nao-aparece-com-o-browser-fechado"></span>
<span id="oauth-volta-com-erro-de-redirect"></span>
<span id="projects-sumiu"></span>
