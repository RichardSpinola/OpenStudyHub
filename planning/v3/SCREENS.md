# Inventário e direção UX — etapa zero

48 rotas de página inventariadas por leitura do código. Rotas dinâmicas e abas representam estados adicionais, não páginas independentes.

**Limite da evidência:** este é um inventário completo de código e uma revisão por padrões, apoiada nas capturas fornecidas. Não significa que todas as páginas foram abertas e testadas em navegador. As prévias usam dados fictícios.

## Cobertura de rotas

| Rota                                                                  | Família                  | Entrada de código                                                                     |
| --------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `/activities`                                                         | Disciplinas e atividades | `src/app/activities/page.tsx`                                                         |
| `/admin/academic`                                                     | Admin legado             | `src/app/admin/academic/page.tsx`                                                     |
| `/admin/audit`                                                        | Admin legado             | `src/app/admin/audit/page.tsx`                                                        |
| `/admin`                                                              | Admin legado             | `src/app/admin/page.tsx`                                                              |
| `/admin/users`                                                        | Admin legado             | `src/app/admin/users/page.tsx`                                                        |
| `/chat`                                                               | Chat                     | `src/app/chat/page.tsx`                                                               |
| `/control/academics`                                                  | Admin                    | `src/app/control/academics/page.tsx`                                                  |
| `/control/catalog`                                                    | Admin                    | `src/app/control/catalog/page.tsx`                                                    |
| `/control/extras`                                                     | Admin                    | `src/app/control/extras/page.tsx`                                                     |
| `/control/google`                                                     | Admin                    | `src/app/control/google/page.tsx`                                                     |
| `/control/grants`                                                     | Admin                    | `src/app/control/grants/page.tsx`                                                     |
| `/control/institutions/[institutionId]/courses/[courseId]`            | Admin                    | `src/app/control/institutions/[institutionId]/courses/[courseId]/page.tsx`            |
| `/control/institutions/[institutionId]/courses/[courseId]/transition` | Admin                    | `src/app/control/institutions/[institutionId]/courses/[courseId]/transition/page.tsx` |
| `/control/institutions/[institutionId]`                               | Admin                    | `src/app/control/institutions/[institutionId]/page.tsx`                               |
| `/control/institutions`                                               | Admin                    | `src/app/control/institutions/page.tsx`                                               |
| `/control/login`                                                      | Admin                    | `src/app/control/login/page.tsx`                                                      |
| `/control`                                                            | Admin                    | `src/app/control/page.tsx`                                                            |
| `/control/password`                                                   | Admin                    | `src/app/control/password/page.tsx`                                                   |
| `/control/setup`                                                      | Admin                    | `src/app/control/setup/page.tsx`                                                      |
| `/control/system`                                                     | Admin                    | `src/app/control/system/page.tsx`                                                     |
| `/control/transition`                                                 | Admin                    | `src/app/control/transition/page.tsx`                                                 |
| `/control/users`                                                      | Admin                    | `src/app/control/users/page.tsx`                                                      |
| `/documents`                                                          | Documentos               | `src/app/documents/page.tsx`                                                          |
| `/documents/templates/[templateId]`                                   | Documentos               | `src/app/documents/templates/[templateId]/page.tsx`                                   |
| `/extras/games/[game]`                                                | Extras                   | `src/app/extras/games/[game]/page.tsx`                                                |
| `/extras/games`                                                       | Extras                   | `src/app/extras/games/page.tsx`                                                       |
| `/extras`                                                             | Extras                   | `src/app/extras/page.tsx`                                                             |
| `/extras/whiteboard`                                                  | Extras                   | `src/app/extras/whiteboard/page.tsx`                                                  |
| `/gestao/login`                                                       | Gestão                   | `src/app/gestao/login/page.tsx`                                                       |
| `/gestao`                                                             | Gestão                   | `src/app/gestao/page.tsx`                                                             |
| `/gestao/password`                                                    | Gestão                   | `src/app/gestao/password/page.tsx`                                                    |
| `/gestao/transition`                                                  | Gestão                   | `src/app/gestao/transition/page.tsx`                                                  |
| `/google`                                                             | Google                   | `src/app/google/page.tsx`                                                             |
| `/login`                                                              | Acesso e instalação      | `src/app/login/page.tsx`                                                              |
| `/notes/[noteId]`                                                     | Notas                    | `src/app/notes/[noteId]/page.tsx`                                                     |
| `/notes`                                                              | Notas                    | `src/app/notes/page.tsx`                                                              |
| `/onboarding`                                                         | Acesso e instalação      | `src/app/onboarding/page.tsx`                                                         |
| `/`                                                                   | Home                     | `src/app/page.tsx`                                                                    |
| `/profile/[userId]`                                                   | Configurações e perfil   | `src/app/profile/[userId]/page.tsx`                                                   |
| `/projects/[projectId]`                                               | Projetos                 | `src/app/projects/[projectId]/page.tsx`                                               |
| `/projects/new`                                                       | Projetos                 | `src/app/projects/new/page.tsx`                                                       |
| `/projects`                                                           | Projetos                 | `src/app/projects/page.tsx`                                                           |
| `/schedule`                                                           | Hoje e horários          | `src/app/schedule/page.tsx`                                                           |
| `/settings`                                                           | Configurações e perfil   | `src/app/settings/page.tsx`                                                           |
| `/setup`                                                              | Acesso e instalação      | `src/app/setup/page.tsx`                                                              |
| `/subjects/[subjectId]`                                               | Disciplinas e atividades | `src/app/subjects/[subjectId]/page.tsx`                                               |
| `/subjects`                                                           | Disciplinas e atividades | `src/app/subjects/page.tsx`                                                           |
| `/today`                                                              | Hoje e horários          | `src/app/today/page.tsx`                                                              |

## Revisão por família

### Home

- Direção: Foco, sugestões reais, atalhos e wallpaper; enquadramento responsivo do shell.
- Evidência/restrição: Home é página de nova aba, não busca universal do Hub.

### Hoje e horários

- Direção: Limites reais de horário, localização sem repetição, eventos excepcionais e priorização.
- Evidência/restrição: Preservar o conteúdo útil do Hoje; horários civis no fuso da instância.

### Disciplinas e atividades

- Direção: Cabeçalhos/capas, histórico e seis abas coesas; ações e aulas em coluna independente.
- Evidência/restrição: O CSS da visão geral usa duas linhas compartilhadas com o mural; agrupar a lateral evita a dependência da altura do conteúdo.

### Notas

- Direção: Biblioteca e workspace com navegação por páginas, blocos e propriedades recolhíveis.
- Evidência/restrição: Leitura compartilhada atual não equivale a edição colaborativa; atualizar autorização e persistência.

### Documentos

- Direção: Escolha de modelo → importação autorizada → campos mapeados → prévia → geração; biblioteca legível.
- Evidência/restrição: Credencial do destino e acesso ao modelo precisam ser resolvidos antes da cópia.

### Projetos

- Direção: Criar vazio e importar com intenções distintas; destino, progresso, prévia, versões e retomada.
- Evidência/restrição: Staging persistente e job idempotente são correções estruturais, não somente visuais.

### Chat

- Direção: Últimas mensagens, paginação anterior, busca, anexos e compartilhamento explícito.
- Evidência/restrição: Editar/excluir precisa reconciliar os demais clientes; DMs não entram em moderação administrativa comum.

### Extras

- Direção: Biblioteca de jogos alinhada; superfícies de jogo com controles acessíveis; quadro com salvamento fiel.
- Evidência/restrição: Não usar overflow:hidden para esconder ações que não cabem. Manter bloqueio das rotas por feature flag.

### Configurações e perfil

- Direção: Conta, Aparência, Integrações, Notificações, Ajuda e Sobre; opção local de formato do avatar.
- Evidência/restrição: Capas já têm backend; wallpaper usa cover/center. Enquadramento desejado precisa de controle próprio.

### Google

- Direção: Conexão, última verificação, ação necessária, disciplinas e destino dos arquivos.
- Evidência/restrição: Erro transitório, perda de acesso e revogação são estados distintos.

### Admin

- Direção: Visão geral, Acadêmico, Pessoas/permissões, Integrações e Sistema; tarefas e pendências concretas.
- Evidência/restrição: Formulários em bloco e menus de entidades escondem a sequência; o fluxo deve mostrar dependências e próximo passo.

### Gestão

- Direção: Mesmos componentes do Admin, limitados às capacidades e escopos reais.
- Evidência/restrição: Admin e gestor têm sessões distintas; concessões não autorizam leitura de conteúdo privado.

### Acesso e instalação

- Direção: Passos claros, posições estáveis de Voltar/Continuar, revisão final e erros próximos ao campo.
- Evidência/restrição: Setup e usuários devem ser exercitados em dados fictícios; não reiniciar setup da instalação existente.

### Admin legado

- Direção: Inventariar dependências e planejar transição para Control Plane consistente.
- Evidência/restrição: Não remover rotas legadas sem verificar compatibilidade, autorização e links existentes.

## Regras visuais para implementação

- Mesmos componentes e fluxos nos dois temas; Material com superfícies discretas e Legacy com bordas retas/monospace.
- Conteúdo principal e lateral independentes; nada depende de linhas de grid criadas pelo tamanho de outro painel.
- Bibliotecas usam linhas compactas/listas e filtros claros; mural continua feed. Não transformar todo conteúdo em cartões.
- Cabeçalhos, botões e campos partilham espaçamento; menus secundários usam ⋯.
- Em telas estreitas, reorganizar a composição; não reduzir a página inteira nem esconder ações por recorte.
- Rolagem natural em conteúdo longo; jogos dimensionam tabuleiro e recolhem opções secundárias.
- QA representativo: 1920×1080, 1366×768, 1280×720, 1024×768 e 360×800. Conferir teclado e ampliação.

## Sintomas ainda pendentes

- Área preta/corte da captura de Configurações: não foi reproduzido na auditoria anterior.
- Wallpaper: existe cover/center, mas o enquadramento desejado ainda requer comparação visual.
- Ícones e bordas da navegação Legacy: revisar no shell real por tema/layout e largura.

## Fluxos principais e condição de aprovação

1. Setup fictício → instituição/curso/período/turma → revisão → criação do Admin; posições fixas dos botões.
2. Cadastro/contexto/matrícula → ferramentas do usuário sem espelhamento manual.
3. Gestor com um escopo → ações permitidas naquele escopo e negação fora dele.
4. Curso com vínculos → mostrar impacto e preservar trabalhos; curso vazio → permitir excluir.
5. Modelo autorizado → destino certo → campos → cópia → acesso do usuário, sem alterar original.
6. Projeto → prévia → envio → nova versão → reconexão, sem pasta ou versão duplicada.

Os testes da etapa zero verificam fronteiras existentes de dados/serviços. Percursos visuais completos serão conferidos nas etapas responsáveis, em vez de declarados aprovados pela existência de testes unitários.

## Refinamento após avaliação da prévia

A estrutura foi bem recebida, mas não deve substituir indiscriminadamente o layout anterior. Preservar os elementos aprovados e ajustar os pontos indicados:

- Home: lápis de personalização presente e acessível; cursor inicial mantido no desktop.
- Disciplina: Mural/Timeline na visão geral; seis abas continuam próprias; capa só no Admin, com autorização server-side a implementar.
- Biblioteca: Documentos/Projetos entram por uma única navegação, com abas, criação/importação específicas e lista/grade. Notas e Chat não são fundidos nesta área.
- Admin: configuração de Extras em Sistema; escolha de tema também disponível na superfície Admin.
- Material: estilo original da V2 preservado; a recoloração da prévia foi rejeitada no feedback posterior. Terminal: bordas retas, monospace e sinais de navegação aprovados.
- Servidor: implantação suspensa; a revisão é local.

Referências oficiais de design:

- [Material 3 — papéis de cor](https://m3.material.io/styles/color/roles)
- [Material 3 — tipografia](https://m3.material.io/styles/typography/applying-type)
- [Material 3 — abas](https://m3.material.io/components/tabs/overview)
- [Material 3 — FAB](https://m3.material.io/components/floating-action-button/overview)

## Correção da direção visual após novo feedback

Preservar a organização das barras atuais e componentes aprovados. Personalização da Home continua numa lateral com todos os grupos originais; sugestões aparecem em sobreposição. Texto do título é exclusivo do Admin, aparência pessoal é separada. Biblioteca mantém Documentos/Projetos separados e suas representações gráficas; Notas continua própria, com prévia de folha. Acadêmico passa por instituição antes das tarefas contextuais. As demais rotas ainda não são simuladas; ausência na prévia não significa remoção no produto.

## Fechamento da revisão visual da etapa zero

A referência final é [FINAL_UX_REVIEW.md](FINAL_UX_REVIEW.md). As amostras foram ampliadas para Hoje, lista de Disciplinas, proposta de Notas e Admin contextual por instituição/curso, além das áreas anteriores. Revisão completa na prévia cobre todas as famílias e identifica o que não foi simulado. Saúde/versão e resumos administrativos ficam visíveis; ajustes de capa pertencem à disciplina. Manter ícones, botões e opções da V2, com apenas os ajustes definidos.
