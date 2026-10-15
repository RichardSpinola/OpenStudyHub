# Etapa 3 — Admin e gestão

Implementação local concluída e conferida na prévia em 14/10/2026. Nenhuma alteração no servidor ou publicação. A revisão visual do usuário e a integração Google real permanecem etapas distintas.

## Entrega

- Identidade visual administrativa própria em todos os menus do Control Plane: navegação lateral, hierarquia de títulos, formulários, tabelas, modais e estados consistentes. Navegação por ícones entre 641 e 760 px; menu recolhível apenas em telas menores. Sistema tem sete seções; Integrações tem quatro.
- Admin organizado em portal de instituições → instituição → curso e suas áreas. Resumos de pessoas/permissões, integrações e operação; detalhes secundários recolhíveis. Extras fica em Sistema.
- Curso pode sair do catálogo por arquivamento sem apagar turmas, matrículas ou trabalhos. Reativação restaura o contexto. Exclusão definitiva exige Admin, confirmação e ausência de vínculos no modelo canônico e nos metadados associados às ferramentas legadas. A interface apresenta dependências, em vez de oferecer uma ação que inevitavelmente falha.
- Concessões conservam os escopos existentes. Revogação imediata; conta inativa não recebe novas responsabilidades. Capas de disciplinas são exclusivamente do Admin no backend e na interface.
- Eventos por instituição, curso, turma ou oferta; aula excepcional por data exige oferta e aparece em Hoje, próximos encontros/Home e disciplina sem criar recorrência na grade permanente. Edição, cancelamento e auditoria conservam o histórico.
- Modo de prova por público e intervalo: somente Admin configura. Backend bloqueia Chat, Notas, Biblioteca/Documentos/Projetos e Extras em páginas, APIs, ações e realtime; Home/busca, Hoje e disciplinas continuam disponíveis. Conta fora do público permanece livre. Cancelar ou atingir o fim libera o acesso.
- Interface aberta acompanha mudanças de prova e atualiza seus controles; a autorização server-side não depende dessa atualização. O recurso restringe ferramentas internas do Hub, não é um navegador de prova que controla sites externos.

## Complementos da revisão

- Seletor único de ícone no App e Admin: abreviação, imagem do site ou personalizado. Catálogo pesquisável com 40 ícones; envio de PNG/JPEG/WebP até 2 MB, conversão para PNG pequeno e posse do arquivo validada.
- Trocar o ícone pessoal preserva uma imagem herdada ainda usada por outros atalhos. Uma imagem ausente ou inválida é rejeitada antes de criar o cadastro.
- Busca de favicon não se limita a sites predefinidos: endereço público HTTP/HTTPS, raiz ou imagem declarada pela página, prévia e aviso quando indisponível. Ícone do site usa referência persistida; trocar a URL invalida a prévia antiga.
- Busca na lista de disciplinas por nome, código, curso e professor, conservando cards e histórico.

## Validação realizada

- 77 testes direcionados em 15 arquivos passaram. Typecheck e lint dos arquivos alterados passaram.
- Testes dirigidos cobrem público, instituição divergente, falta de permissão, revogação, início/fim exatos, cancelamento, bloqueio de recursos, preservação do histórico e imagem inválida/grande/pertencente a outro usuário.
- Teste HTTP/realtime no primeiro pacote da Etapa 3: ferramentas redirecionam/negam acesso, POST negado, socket já conectado fecha com 1008, nova conexão recebe 403, outro usuário continua com acesso e cancelamento restaura Biblioteca.
- O usuário reabriu a prévia e o teste de uso foi retomado. Cenários abaixo executados com dados fictícios, usando a interface.
- Build final de produção aprovado; TypeScript e lint dos arquivos alterados aprovados. Dois bancos com integrity_check = ok e nenhuma violação de chave estrangeira.
- Snapshot após aquecer a prévia: App + Admin + realtime somavam aproximadamente 261 MiB. Build separado com um worker e limite de 3 GiB; pico observado de 1,8 GiB. Esses números são da prévia, não uma garantia do consumo em produção.
- O reteste HTTP/realtime do pacote final foi recusado pela revisão automática. A primeira recusa citou limite de uso; a repetição foi bloqueada por se tratar do reteste anterior. Não foi executado por outra via. O teste de prova com duas contas foi realizado pela interface, conforme abaixo.

### Fluxo de uma pessoa sem conhecimento técnico

| Cenário                                                                | Resultado                                                                                                                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Criar instituição com nome vazio e corrigir                            | Mensagem de campo obrigatório; cadastro válido salvo e painel aberto.                                                                                                  |
| Criar curso, currículo, semestre, turno e turma                        | Cadastros concluídos na interface, no contexto correto.                                                                                                                |
| Criar turma antes de currículo/turno                                   | Ajustado: agora apresenta os pré-requisitos e links, em vez de um formulário com listas vazias.                                                                        |
| Arquivar curso com turma e currículo; reativar                         | Histórico preservado; contexto recuperado. Exclusão definitiva bloqueada por dependências.                                                                             |
| Importar CSV com login existente e linha sem login                     | Duas linhas rejeitadas; nenhuma opção de aplicar o lote inválido.                                                                                                      |
| Conceder horários ao usuário B em curso de teste; revogar              | Gestão só apresenta o curso delegado. Sem opção de modo de prova. Revogação remove o curso do acesso.                                                                  |
| Criar aula excepcional para toda instituição, corrigir para disciplina | Erro compreensível e rascunho preservado; correção salva. Evento aparece em Hoje, próximo encontro e disciplina.                                                       |
| Ativar prova para disciplina do usuário A                              | Menu restrito; acesso direto à Biblioteca redireciona para Hoje. Usuário B continua livre. Cancelamento libera A.                                                      |
| Navegar todas as áreas da instituição e curso                          | Configuração, disciplinas, períodos, turnos, professores, salas, turmas, currículo, ofertas, horários, matrículas, gestores e eventos abriram sem erro.                |
| Navegar Usuários, Permissões, Integrações, Sistema e Extras            | Seções conferidas; importação acadêmica inspecionada sem aplicar migração.                                                                                             |
| Buscar ícone público sem preset                                        | Wikipedia encontrada no Admin e no App. Atalho pessoal salvo exibe imagem carregada, inclusive após a resposta de salvamento.                                          |
| Selecionar catálogo sobreposto durante edição                          | Corrigido fechamento indevido do formulário pai; seleção permanece editável. Catálogo com 40 ícones e busca.                                                           |
| Enviar imagem acima de 2 MB, depois imagem pequena                     | Arquivo grande recusado na interface; imagem válida visualizada e salva. Backend também cobre tipo, tamanho, posse e arquivo herdado.                                  |
| Resoluções                                                             | Admin 800, 656 e 390 px sem overflow horizontal; tabela de usuários utilizável em 390 px. Hoje 1280 px com quatro blocos pela manhã/tarde e aula excepcional separada. |

### Problemas encontrados e corrigidos durante o teste

- Componentes consultavam conexão V2 já encerrada ao renderizar instituição/curso/eventos. As consultas agora acontecem dentro do ciclo da conexão; cinco testes de regressão renderizam depois de fechar o banco.
- Busca de ícones comparava o Origin do navegador apenas com a URL interna do listener Next. Agora valida também Host/protocolo da requisição, conservando rejeição de origem diferente e autenticação; cinco testes da rota cobrem a correção.
- Fechar catálogo interno propagava o evento de fechamento ao modal pai no Admin. Eventos separados; repetição pela interface confirmou edição e upload.
- Próximos encontros juntavam aulas excepcionais depois dos recorrentes sem ordenar. Lista agora ordenada por data e hora; prévia tem sábado entre sexta e segunda.

Fixtures adicionais permanecem somente no runtime privado de QA: instituição/curso/turma de teste, uma aula excepcional futura, quatro horários recorrentes e atalhos Wikipedia. Concessão temporária e prova temporária foram revogadas/canceladas. Nenhum segredo entrou no pacote.

Novas contas/senhas serão cobertas no backend; nenhuma credencial nova é digitada pela automação do navegador. Google real continua reservado à conferência da Etapa 8, com confirmação do usuário naquele momento.

## Conferência final futura

A Etapa 8 será dividida em instalação nova, Google real/Drive/Classroom/documentos/projetos, atualização/backup/restauração e distribuição/publicação. Reutilização de credenciais da instalação real exige confirmação do usuário naquele momento; nenhuma credencial foi copiada nesta etapa.

## Revisão ampliada solicitada pelo usuário

A organização de todos os menus e da primeira instalação foi revista novamente na etapa 4. [STAGE_4.md](STAGE_4.md) registra as correções e a verificação atual; Extras passou a ter entrada própria no menu administrativo.
