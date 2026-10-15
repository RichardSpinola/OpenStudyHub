# Etapa 4 — arquivos, projetos e revisão completa do Admin

Entrega local da V3 em 15/10/2026. Inclui a revisão adicional de todos os menus administrativos solicitada pelo usuário. Servidor de produção, credenciais reais e GitHub não foram alterados.

## Admin: o que foi revisto

| Área                 | Resultado                                                                                                                                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primeiro acesso      | Quatro passos: instituição/idioma/fuso; conta Admin; primeiro curso/turma/período; conferência. Valida campos, login, senha e confirmação, duração e datas reais. Cria currículo, semestres e vínculos iniciais de uma vez. Rascunho não guarda senhas. Voltar permanece à esquerda e Continuar à direita. |
| Visão geral          | Instituições como ponto de entrada. Orientações de configuração identificam instituição e curso; etapas concluídas não ocupam a tela.                                                                                                                                                                      |
| Instituição          | Cursos, disciplinas/capas, eventos, cadastros básicos e configuração têm caminhos distintos. Disciplinas, períodos, turnos, professores e salas ficam agrupados em cadastros básicos.                                                                                                                      |
| Curso e currículo    | Navegação alinhada com a área de conteúdo; explicação da sequência currículo → semestres → disciplinas → período da turma. Semestres e seleções mostram a versão do currículo. Resumo não apresenta uma única turma como se representasse o curso inteiro.                                                 |
| Capas                | Cartões por disciplina/período/turma com ação explícita de edição, prévia de imagem e restauração. Continua exclusivo do Admin, inclusive no backend.                                                                                                                                                      |
| Usuários             | Lista e gerenciamento de uma conta separados. A conta selecionada independe do limite/filtro da lista; voltar conserva os filtros. Criação/importação em lote não disputam espaço com a gestão da conta.                                                                                                   |
| Gestores             | Um formulário: pessoa → alcance → área → responsabilidade. Opções dependem do alcance. Instituição, curso, período e turma distinguem seleções com nomes parecidos. Revogação e limites de acesso anteriores são preservados.                                                                              |
| Horários             | Disciplina identificada também pelo período. Validação de fim/início e sobreposição antes do envio; rascunhos por disciplina sobrevivem à navegação e a rejeições. Salvar uma disciplina não descarta as outras edições pendentes.                                                                         |
| Eventos e provas     | Aula excepcional oferece apenas disciplinas como destino. Datas invertidas são explicadas no formulário. Próximos eventos ordenados; anteriores/cancelados recolhidos com histórico preservado. Eventos por data continuam separados da grade semanal.                                                     |
| Transição de período | Nomes de estados em linguagem comum, retorno ao curso e revisão do impacto antes de ativar. Não altera o modelo acadêmico nem reutiliza ofertas antigas.                                                                                                                                                   |
| Integrações          | Conexões, armazenamento, automação e contas/disciplinas. Correção da troca de aba ao abrir uma URL com área selecionada. Inventário antes da troca de conta Drive e política de acesso aos novos documentos.                                                                                               |
| Sistema              | Sete áreas existentes conferidas: identidade, atalhos, recursos/modelos, busca, idioma, backup e diagnóstico. Mantém os recursos e usa a navegação/estados comuns do Admin.                                                                                                                                |
| Extras               | Entrada própria e visível no menu administrativo, mantendo as permissões e opções existentes.                                                                                                                                                                                                              |
| Importação antiga    | Ferramenta secundária identificada como atualização de uma instalação antiga. Matriz reconhece as 55 tabelas atuais e as 52 anteriores; tabelas desconhecidas continuam bloqueadas.                                                                                                                        |
| Erros e formulários  | Mensagens de duplicação e vínculos; apenas o formulário rejeitado reabre com seu rascunho não secreto. Feedback antigo de sucesso/erro é substituído na próxima operação.                                                                                                                                  |

A busca de disciplinas adicionada sem solicitação foi removida. A organização anterior por período foi mantida. O tema principal do App não foi substituído por outro tema.

## Projetos e arquivos

- Projetos novos podem usar armazenamento local, sem Google. O formulário informa o destino e não oferece Drive indisponível como se estivesse pronto. Projetos antigos conservam seu backend Drive e suas referências.
- Preparação de upload fica em `PRIVATE_ASSET_PATH/projects/staging`, com expiração de uma hora e retomada na página do projeto. O diretório temporário antigo ainda é reconhecido para prévias em andamento anteriores à atualização.
- Confirmação tem reserva exclusiva por projeto, identificador de execução, renovação e recibo persistente. Repetir a mesma confirmação devolve seu resultado; confirmações concorrentes não criam duas versões. Uma execução vencida não publica nem libera a reserva de outra execução.
- O formulário vincula a confirmação ao projeto correto. Trocar de projeto não reaproveita o estado de upload do anterior.
- Versões locais ficam em diretório privado. APIs de leitura/download revalidam o acesso. A prévia textual compara tamanho e hash com os metadados gravados. Arquivos enviados não são executados.
- Detalhe do projeto dividido em Arquivos, Versões, Compartilhar e Configurações. Remove o cabeçalho duplicado. Controles de alteração ficam apenas com o dono.
- Leitura compartilhada com pessoas e grupos. Participação atual e arquivamento do grupo são reavaliados a cada leitura; sair do grupo retira o acesso. Compartilhar no App não concede permissão no Google Drive.
- Arquivamento mantém arquivos e versões. Tela de projetos arquivados permite restaurar. Uma versão anterior continua disponível em ZIP e pode ser importada como nova versão após conferência das diferenças.
- Projetos acadêmicos novos usam a hierarquia do curso, dentro da raiz da instituição, com categoria Projetos. Área pessoal é criada sob demanda. Pastas antigas vinculadas são preservadas, sem mover ou duplicar silenciosamente.
- Salvar novamente a mesma conta responsável não apaga sua raiz. Trocar conta fica bloqueado quando há raiz ou referências legadas; o inventário inclui documentos, modelos, projetos e pastas acadêmicas.
- Pasta vinculada ausente, falta de permissão e indisponibilidade não são tratados como autorização para criar uma substituta. Recuperação mantém as referências existentes e pede restauração/conferência.
- Backup manual reconhece os ZIPs privados dos projetos. Backup automático/criptografado e ensaio integrado de restauração continuam na etapa 7/8.

## Documentos e modelos

- Importação DOCX e Google Docs recolhíveis na Biblioteca, mantendo os modelos gráficos e os fluxos existentes.
- Modelo Google pessoal é lido com a identidade do usuário e copiado/convertido para o armazenamento autorizado. O registro passa a apontar para a cópia; o original permanece intacto. Identidades de origem e destino não são confundidas.
- Arquivos DOCX/modelos importados têm pasta por usuário. O gerador mantém a identidade de armazenamento que pertence ao documento/modelo, inclusive após mudança de configuração.
- Admin escolhe acesso pelo App ou edição direta no Google para novos documentos. O modo App não concede nova permissão Google. A configuração não revoga permissões externas preexistentes.
- Documentos próprios/compartilhados podem ser visualizados como PDF por uma rota privada do Hub, com autorização e bloqueio em período de prova. Arquivar o grupo ou sair dele retira o acesso por grupo.
- Abrir a base de um modelo central verifica o dono e sua identidade Google antes de conceder edição para essa própria conta. Modo App oferece PDF; não concede permissão Google. Não se aceita um e-mail arbitrário do formulário como destinatário.

## Verificação técnica

- Suíte integrada final: **400 testes passaram em 109 arquivos**, em 15/10/2026. Inclui os quatro casos novos de acesso à base de modelos (dono, outra pessoa, identidade Google divergente, modo App e mapa de identidade canônica).
- Testes direcionados de instalação, projetos e acesso a modelos também passaram durante os ajustes. A última execução integrada inclui as alterações finais do código.
- Cobertura inclui instalação vazia, datas impossíveis, login/senha inválidos, segunda inicialização bloqueada, migração preservando versões e FKs, reinício durante preparação, confirmação concorrente/idempotente, ZIP adulterado, expiração, acesso de terceiros, grupos, arquivamento/restauração, importação com duas identidades e referências antigas.
- Lint e verificação de tipos passaram. Compilação local e teste final da prévia registrados abaixo.
- Cópias dos dois bancos de QA foram salvas antes da migração 0017. Migrações já aplicadas não foram reescritas. A nova migração e seu snapshot fazem parte do pacote.

## Teste como usuário iniciante

Conferidos no navegador, com dados fictícios:

- Curso: código repetido rejeitado; nome, código e sigla mantidos no formulário. Corrigir o código permitiu concluir o cadastro.
- Evento: fim anterior ao início rejeitado sem perder os campos. Correção permitiu salvar; edição e cancelamento funcionaram, mantendo o evento no histórico.
- Gestor: selecionar turma oferece apenas responsabilidades compatíveis, sem promover a conta a Admin.
- Sistema: as sete abas abriram corretamente. Integrações: troca de áreas não ficou presa à primeira URL. Extras tem acesso direto.
- Capa: ação encontrada por disciplina; envio, prévia, salvamento e restauração conferidos. Período/turma distinguem disciplinas repetidas. Corrigido o fechamento do editor após uma ação bem-sucedida na mesma rota.
- Instalação vazia: campo obrigatório explicou o erro; instituição e fuso foram mantidos ao avançar/voltar. A criação da conta e da estrutura completa foi exercitada em testes backend; nova senha não foi digitada pela automação do navegador.
- Horários: fim anterior ao início bloqueado com explicação e dados mantidos. Trocar de disciplina e recarregar recuperou o rascunho. Correção do intervalo permitiu enviar o formulário.
- Projeto local: criação sem Google, envio de ZIP com dois arquivos, retomada da prévia após recarregar, confirmação, versão 1 no histórico e leitura do README pela interface. ZIP baixado foi aberto e seu conteúdo comparado com o enviado.
- Responsividade: Admin conferido em 1280, 800 e 390 pixels; instalação em 1280 e 390. Nas telas medidas não houve transbordamento horizontal. Voltar e Continuar permaneceram separados.

## Prévia, evidência e consumo de memória

- A compilação final de produção passou, incluindo a verificação de tipos, e foi aplicada somente à prévia local. A compilação final levou aproximadamente 1 min 41 s, com pico de 1,7 GiB de memória e uso de swap. Esse custo é da preparação da prévia, não uma medição de uso normal do App.
- O notebook apresentou pressão de memória durante esta sessão. Ao receber o relato de travamento, os serviços locais de App, Admin, realtime e instalação temporária foram encerrados. Nenhuma nova compilação ou suíte foi iniciada depois disso. A prévia está pausada para liberar recursos.
- Vitest passou a limitar a execução a dois processos. Nas próximas sessões, executar uma verificação pesada por vez e encerrar a instalação temporária após o teste. Não manter navegador de testes e compilações simultâneos neste notebook.
- A medição anterior ao encerramento, com os serviços recém-iniciados, foi aproximadamente 69 MiB no App, 62 MiB no Admin e 48 MiB no realtime, mais 48 MiB de swap no realtime. São valores pontuais, sem carga representativa; não demonstram uma redução percentual de RAM. O diagnóstico de desempenho do produto continua na etapa 7.
- [Primeira instalação — captura da prévia](evidence/stage4-first-install.png).

### Limitação da última conferência visual

O navegador de automação ficou indisponível durante o teste de confirmação de arquivamento. Arquivamento e restauração passaram nos testes automáticos; o ciclo final pelo navegador não foi concluído. Também ficou pendente rever visualmente os três ajustes feitos no encerramento: fechar o editor após restaurar a capa, conservar as sugestões de linguagem ao retomar a importação e trocar o link Drive indevido pelo download do ZIP em projetos locais. Esses ajustes estão na compilação final aprovada, mas não são apresentados como retestados pela interface.

A instalação temporária não ficou exposta. Os bancos de QA e arquivos fictícios são privados e não entram no pacote público. A captura contém apenas dados fictícios.

## Limites e próxima etapa

Google real não foi conectado: importação, exportação e permissões externas foram verificadas com respostas sintéticas. OAuth, conversão visual e permissões herdadas serão conferidos na instância separada da etapa 8, com nova autorização antes de usar os secrets do servidor, como solicitado pelo usuário.

Próxima etapa principal: **5 — workspace de Notas**. Chat/jogos seguem na 6; configurações gerais do App, desempenho, idioma e backup na 7. Ajustes encontrados nesta revisão não autorizam trocar o tema Material existente nem alterar a produção.

## Referências de implementação

- [Exportação de arquivos Google Workspace](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export).
- [Upload e conversão para Google Workspace](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
- [Permissões do Google Drive](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create).

## Revisão visual solicitada após a entrega

[Correções de 15/10/2026](REVIEW_FIXES_2026_10_15.md): substituição da grade pelo formato compacto da referência, ajustes do workspace de projetos, exclusão definitiva com confirmação, enquadramento comum e faixa lateral do wallpaper. Esta revisão antecede a etapa 5.
