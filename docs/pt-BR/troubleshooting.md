# Solução de problemas

| Sintoma                               | Confira primeiro                                                          | Próximo passo                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Instalador não encontra Docker        | Docker instalado/ativo e acesso da conta                                  | Siga o guia do sistema; o script não instala Docker                                                 |
| Tag da imagem pública indisponível    | Estado da publicação e tag exata                                          | Aguarde ou use imagem local explicitamente confiável                                                |
| Diretório/projeto já existe           | Destino correto                                                           | Use o guia de atualização; não apague o volume                                                      |
| Porta ocupada                         | Outro processo ou instância                                               | Escolha outra porta antes de instalar                                                               |
| Health do App 503                     | Migrations, bancos distintos e graváveis, permissões                      | Confira logs privados; não apague o banco para reparar                                              |
| Health 200 com realtime degradado     | Saúde interna e proxy                                                     | Confira rotas WebSocket `/realtime` e `/whiteboard`                                                 |
| Google não configurado                | Client ID/secret, callback e chave                                        | Configure em privado e reinicie App/Admin                                                           |
| `redirect_uri_mismatch`               | Origem pública, porta e caminho exatos                                    | Corrija a URI `/api/v2/google/callback` cadastrada                                                  |
| Material Classroom ausente            | Associação pessoal, aba materiais e última sync                           | Reconecte/sincronize; avisos e atividades não são materiais                                         |
| Drive recusa arquivo                  | Autorização `drive.file` e cliente OAuth dono                             | Importe/autorize corretamente ou gerencie no Drive                                                  |
| Rotina de backup não executa          | Agenda ativa e sinal do worker                                            | Mantenha realtime ou um worker alternativo ativo                                                    |
| Nota não salva                        | Confirmação do servidor e aviso de rascunho                               | Baixe o rascunho; não limpe os dados do navegador                                                   |
| Código de duas etapas sempre recusado | Relógios do servidor e do celular, código não usado, limite de 15 minutos | Aguarde um novo código; use um código de recuperação ou a [recuperação pelo terminal](admin-mfa.md) |
| Assistente de IA não responde         | Ativado após o teste, provedor acessível pelo contêiner, fila/cota        | Veja [solução de problemas da IA local](local-ai.md#solucao-de-problemas)                           |

## Envie um relato útil

Informe versão, tela, passos, resultado esperado/obtido e captura sanitizada. Compartilhe somente trechos relevantes de logs depois de remover tokens, cookies, códigos, e-mails e IDs privados. Não anexe `.env`, bancos, backups ou chaves.

Em instalações do assistente, `bash scripts/install-server.sh --diagnose --directory SEU_DIRETORIO` é somente leitura. `install.log` bruto e configuração Compose completa são privados. Para recuperar, use [o procedimento offline](operations/manual-backup-restore.md), não mudanças SQL improvisadas.

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
<span id="troubleshooting"></span>
