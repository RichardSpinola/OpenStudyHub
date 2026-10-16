# Backlog V3 — cobertura dos pedidos e achados

**Estado:** A01 consolidado; entrega local da etapa 1 registrada em [STAGE_1.md](STAGE_1.md). A21/A22 e a interface de A23 foram implementados; teste vivo do provedor requer chave. Biblioteca/Hoje receberam a organização solicitada. Demais itens e partes futuras continuam planejados; A20 mantém reprodução pendente. Achados de código não são equivalentes a reprodução em navegador. Nenhum item some por não aparecer no resumo de uma etapa.

## Achados técnicos

| ID  | Etapa | Evidência                | Trabalho                                                                                         | Critério de fechamento                                                                     |
| --- | ----- | ------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| A01 | 0     | Confirmado               | Uma base única: hotfix e patches pós-release, autoria das mudanças e identificação da imagem.    | Checkpoint rastreável; V2 preservada; patches sem dados particulares.                      |
| A02 | 2     | Confirmado               | Eliminar leituras acadêmicas contraditórias entre V2 e legado em todas as ferramentas.           | Cadastro, matrícula e retirada pelo Admin refletem acesso sem scripts privados.            |
| A03 | 2     | Confirmado na auditoria  | Classroom alimenta as atividades corretas de cada usuário.                                       | Contas diferentes têm suas tarefas; sync repetido não duplica nem mistura dados.           |
| A04 | 2     | Confirmado               | Preservar descrição, prazo, materiais e estados de submissão do Classroom.                       | Hoje/atividades/modelos usam o mesmo contexto e mantêm estados pessoais.                   |
| A05 | 2     | Confirmado               | Importador com execução completa, conflitos, mapa de IDs e repetição segura.                     | Importação de origens suportadas preserva conteúdo e passa integridade/FKs.                |
| A06 | 2     | Confirmado               | Fuso explícito para datas locais, aulas e agrupamentos do Hoje.                                  | Mesmo resultado em servidor UTC e usuário no fuso configurado.                             |
| A07 | 4     | Implementado localmente  | Proprietário/backend/acesso no schema; inventário completo antes de trocar storage owner.        | Não perder arquivos legados nem ampliar acesso ao mudar política/proprietário.             |
| A08 | 4     | Implementado localmente  | Importação do modelo pessoal para o destino autorizado antes de mapear/gerar.                    | Picker e storage central trabalham com duas identidades sem tocar o original.              |
| A09 | 4     | Implementado localmente  | Recuperação guiada da raiz/pastas; distinguir 403, 404 e indisponibilidade.                      | Não substituir raiz nem duplicar pastas silenciosamente.                                   |
| A10 | 4     | Implementado localmente  | Staging de Projects persistente com expiração e retomada clara.                                  | Prévia sobrevive à recriação do serviço até o TTL.                                         |
| A11 | 4     | Implementado localmente  | Confirmação de Projects com posse exclusiva e idempotência.                                      | Duas confirmações concorrentes produzem uma única versão válida.                           |
| A12 | 7     | Confirmado no fluxo      | Streaming, orçamento de corpo e concorrência limitada para ZIP/upload/download.                  | Carga grande não cria múltiplas cópias integrais em RAM; limites antes de materializar.    |
| A13 | 7     | Confirmado               | Cache curto de access token e deduplicação de refresh por conta.                                 | Menos renovações; revogação continua refletida corretamente.                               |
| A14 | 4     | Implementado localmente  | Projects com backend local e diagnóstico antecipado do destino.                                  | Criar, enviar e baixar versões sem Google configurado.                                     |
| A15 | 6     | Confirmado               | Propagar editar/excluir mensagem entre clientes com revisão/tombstone.                           | Duas contas convergem após ação e reconexão.                                               |
| A16 | 6     | Confirmado               | Últimas mensagens primeiro, paginação anterior e janela limitada.                                | Conversa longa abre no presente sem acumular histórico inteiro.                            |
| A17 | 5     | Risco no fluxo           | Proteção contra sobrescrita de notas e falha de autosave; evolução para colaboração.             | Duas abas/participantes não apagam trabalho recente; rascunho recuperável.                 |
| A18 | 6     | Risco no fluxo           | Quadro com lote identificado, ACK e retransmissão idempotente.                                   | Queda entre envio e confirmação não apresenta salvamento falso.                            |
| A19 | 6     | Confirmado/proposta      | Gravação consolidada, limites claros, compactação, exportação e ciclo de vida do quadro.         | Cena grande não cresce indefinidamente; tema e restauração coerentes.                      |
| A20 | 1     | Sintoma pendente         | Reproduzir corte/área preta em Configurações.                                                    | Identificar causa na interface real e cobrir resolução afetada.                            |
| A21 | 1     | Reproduzido isoladamente | Aviso Google cria linha adicional no shell e sobrepõe o conteúdo.                                | Shell calcula as regiões corretamente nos temas e navegações existentes.                   |
| A22 | 1     | Confirmado/pedido        | Foco inicial e retorno à busca na Home/nova aba, preservando texto útil.                         | Desktop permite começar a digitar; celular não abre teclado sem intenção.                  |
| A23 | 1     | Pedido aprovado          | Autocomplete real opcional por API oficial configurada; teclado e provedor final preservados.    | Sem serviço/chave a busca funciona; não disfarçar atalhos de sugestões web.                |
| A24 | 6     | Pedido aprovado          | Confete breve e som opcional ao vencer.                                                          | Dispara uma vez por vitória, som desligado inicialmente e redução de movimento respeitada. |
| A25 | 6     | Confirmado/pedido        | Jogos pausam ocultos e teclas não interferem em inputs; verificar chord do Campo Minado.         | Controles/toque e vitória/derrota consistentes nos cinco jogos.                            |
| A26 | 1     | Confirmado               | Consolidar os estilos por componentes gradualmente; idioma revisado no checkpoint final.         | Dois temas coesos sem novas camadas globais contraditórias.                                |
| A27 | 7     | Confirmado               | Conexões do banco reutilizadas e migrations/hashes fora da leitura por request.                  | Menos trabalho por operação com isolamento correto entre usuários.                         |
| A28 | 7     | Confirmado               | Deduplicar automação e reduzir polling de notificações/chat/jogos/Google.                        | Sem jobs duplicados; reconexão e fallback HTTP continuam funcionais.                       |
| A29 | 7     | Confirmado               | Health/readiness do banco canônico e realtime; diagnóstico operacional concreto.                 | Erro real de dependência não aparece como sistema pronto.                                  |
| A30 | 7     | Confirmado               | Configuração oficial de notificações push/VAPID e diagnóstico claro.                             | Instalação nova consegue ativar o recurso sem ajustes particulares.                        |
| A31 | 7     | Confirmado na instalação | Boot com rede tardia e gerenciamento ZimaOS/CasaOS; Compose original preservado.                 | Admin volta após rede; parar/reiniciar pelo gerenciador funciona.                          |
| A32 | 7     | Confirmado/proposta      | Backup operacional consistente, exportação sanitizada distinta, agenda/retenção e restore.       | Recuperação ensaiada; cópia completa nunca declarada após falha parcial.                   |
| A33 | 7     | Risco a validar          | Concorrência e limitação de login/realtime; proteção de autorização.                             | Testes controlados em fixture; nada de teste de carga ofensivo em produção.                |
| A34 | 7     | Confirmado               | Runtime/dependências fixados, imagem identificável/menor e pacote com apenas runtime necessário. | Build reproduzível; consumo comparado antes/depois; segurança de superfície preservada.    |

## Pedidos de produto confirmados

| ID  | Etapa | Pedido                                                                                                                                                                                                         |
| --- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01 | 0–8   | Revisão UX de todas as famílias de telas, profissional e coesa, Material e Legacy, top/classic; uso confortável em monitores pequenos.                                                                         |
| U02 | 1     | Busca pronta para digitar, autocomplete real, arrastar/soltar atalhos, edição/remoção na Home; preservar ASCII.                                                                                                |
| U03 | 1     | Wallpaper com enquadramento ajustável, ícones nas bordas corretas e nenhum corte de viewport.                                                                                                                  |
| U04 | 2     | Hoje organizado, grade pelo intervalo real das aulas e localização sem duplicação; preservar proposta geral.                                                                                                   |
| U05 | 1/3   | Capas de disciplinas exclusivas de Admin, incluindo backend e remoção; cards/histórico e abas consistentes; lateral de aulas sem saltos.                                                                       |
| U06 | 3     | Admin revitalizado; sequência clara de instituição/curso/período/turma/oferta/contexto/matrícula.                                                                                                              |
| U07 | 3     | Gestores e concessões mantidos, testados e compreensíveis; remoção de curso preserva trabalhos e explicita dependências.                                                                                       |
| U08 | 3     | Eventos acadêmicos pontuais e aula excepcional por data, com público/escopo, integrados a Hoje e disciplina.                                                                                                   |
| U09 | 3     | Provas por turma/curso; negar ferramentas internas em rotas/APIs/realtime, mantendo busca e atalhos externos.                                                                                                  |
| U10 | 4     | Drive compartilhado acadêmico + Pessoais separados sob demanda; curso por sigla; projetos dentro da raiz da instituição.                                                                                       |
| U11 | 4     | Privacidade por recurso e compartilhamento com pessoas/grupos; política Admin App-only ou acesso direto.                                                                                                       |
| U12 | 4     | Documentos redesenhados, modelos importados/mapeados e Google Docs acessíveis ao dono real; não baixar local como único fluxo.                                                                                 |
| U13 | 4     | Projects redesenhado; criar/importar distintos; progresso estilo TUI, prévia, versões e recuperação sem pastas duplicadas.                                                                                     |
| U14 | 5     | Notas úteis como workspace: páginas, subpáginas, blocos, busca, grupos, colaboração e bases simples tabela/Kanban.                                                                                             |
| U15 | 6     | Chat integrado a arquivos/projetos/documentos/notas; busca, histórico e fechamento/arquivamento de DMs.                                                                                                        |
| U16 | 6     | Admin configura/modera espaços institucionais com auditoria; DMs privados e denúncia voluntária.                                                                                                               |
| U17 | 6     | Quadro mantido com Excalidraw, mais leve e confiável; cinco jogos adaptáveis, controles bons, confete e som opcional.                                                                                          |
| U18 | 1/7   | Configurações reorganizadas, notificações/integrações/sobre claros, avatar local redondo/quadrado, idioma completo no checkpoint.                                                                              |
| U19 | 7     | Backup completo criptografado no Drive, agendamento/retenção e tutorial de restauração; redução medida de memória.                                                                                             |
| U20 | 0–8   | Nova pasta V3, mesmo histórico/repositório público, commits por etapa, retorno simples, mudanças locais por enquanto e produção suspensa até nova instrução, GitHub no final e novas features após checkpoint. |

## Ajustes confirmados na revisão da prévia

- U21 (etapas 1/4): Biblioteca como entrada principal, com Documentos/Projetos separados por abas; lista/grade selecionáveis. Compatibilidade com `/documents`, `/projects` e links existentes, sem misturar entidades, permissões ou versões. Notas continua área própria.
- U22 (etapas 1/3): lápis de personalização mantido; Mural/Timeline selecionáveis; seis abas da disciplina preservadas e realinhadas. Validar envio/remoção de capa negados a usuário normal e gestor; somente Admin autorizado.
- U23 (etapas 1/3): preservar o Material original da V2, com ajustes pontuais de UX/alinhamento; recoloração verde e novo tratamento arredondado da prévia rejeitados. Legacy/TUI conserva a direção terminal aprovada, sem perder os fluxos.
- U24 (etapas 3/7): controles de Extras em Sistema no Admin; acesso de Extras no App permanece principal. Nenhuma implantação no servidor nesta rodada.

- U25 (etapas 1/3/4): lápis abre barra lateral, preservando fundo, atalhos, relógio, resumo Hoje e buscador. Sugestões em sobreposição, sem deslocamento; título ASCII editável apenas pelo Admin, estilo pessoal permitido. Preservar prévias gráficas de notas/documentos e capas de projetos; usar a organização atual das barras e utilitários.
- U26 (etapa 3): portal acadêmico por instituição, com cartões de entrada e painel contextual. Cursos/períodos/turmas/ofertas/eventos pertencem à instituição selecionada; permissões e autorização devem validar esse contexto no backend, além da navegação.

- U27 (etapas 1/2/4): mesma barra/ícones/botões da V2; única fusão principal é Biblioteca. Lateral conserva presets, imagens pessoais, editar/ocultar atalhos, salvar widgets e buscador; ASCII oferece as nove fontes atuais. Home/Hoje compartilham os destaques; grade semanal é o ajuste pontual do Hoje.
- U28 (etapas 2/4/5): Notas/Documentos/Projetos da disciplina têm múltiplos cartões organizados, prévias gráficas e contexto. Workspace de Notas mantém associação opcional à oferta e a aba da disciplina; ícones das tecnologias preservam rótulos acessíveis.
- U29 (etapa 3): instituição com visão geral → cursos → painel do curso; capa dentro da disciplina, sem atalho solto. Pessoas/permissões, integrações e sistema têm resumos inline e detalhes recolhíveis; não copiar links/notificações do App para Admin. Última revisão da direção visual, preservando o que já foi aprovado.

## Limites já decididos

- Sem IA, vídeo, apresentações ou expansão do quadro para uma plataforma inteira.
- Escopo ampliado pelo usuário na etapa 6: nove jogos (cinco atuais + Memória, Sudoku, Quatro em Linha e Jogo da Velha), Pomodoro/cronômetro e flashcards compartilhados.
- Sem fórmulas/relacionamentos nas bases de Notas desta entrega.
- Não trocar autenticação, idioma ou runtime por sistemas paralelos expostos aos usuários.
- Backups não prometem capturar conteúdo de links externos sem acesso. Manifesto separa cópia real de referência.
- A preparação não publica release, imagem ou documentação. Google real e extensão real exigem validação humana apenas quando houver alteração relevante.
- Ao implementar cada item, registrar evidência, pendência e commit no acompanhamento; não declarar PASS só porque o botão apareceu.

## Revisão de 14/10 — Etapa 3

U05/U06/U07/U08/U09/U24/U26/U29 implementados localmente e conferidos no teste de uso da Etapa 3, registrado em [STAGE_3.md](STAGE_3.md). Painel inteiro recebeu organização administrativa comum; instituições e cursos são portais contextuais. O relatório lista limites de conferência, incluindo Google real futuro e reteste técnico final bloqueado pela revisão automática.

Novo pedido de atalhos: seletor com abreviação/imagem do site/personalizado, catálogo sobreposto e pesquisável, prévia encontrada/indisponível e envio de imagem até 2 MB, no App e Admin. Implementação e testes de limites, posse e preservação de imagens herdadas registrados na Etapa 3. Redesign interno de projeto, modelo Google Docs recolhível e indicador da integração Google permanecem na Etapa 4. Configurações completas permanecem na Etapa 7.

## Revisão de 15/10/2026 — etapa 4

Implementação e limites de A07–A11, A14 e U10–U13 em [STAGE_4.md](STAGE_4.md). A validação Google com contas reais continua na etapa 8. Política de acesso não revoga permissões externas preexistentes. Notas, Chat, jogos, configurações gerais do App e backup automático continuam em suas etapas próprias.

## Revisão de 15/10/2026 — etapa 5

U14 e a parte de Notas de U28 implementados localmente. Páginas/subpáginas, blocos, busca, associação acadêmica opcional, pessoas/grupos com leitura/edição, bases Tabela/Quadro, histórico e recuperação. Créditos e limites em [STAGE_5.md](STAGE_5.md). Integração de referências no Chat continua na etapa 6; backup completo e teste integrado nas etapas 7/8.

### Aparência opcional reservada à etapa 7

Planejar com o usuário um wallpaper com blur nas superfícies selecionadas e possível barra de navegação translúcida. Desligado inicialmente; fundo sólido preservado quando desativado. Nenhuma implementação de blur na etapa 6.

## Revisão de 15/10 — Etapa 7

Configurações recebeu o portal e o redesign dos oito grupos internos; Home mantém os controles existentes de enquadramento/atalhos. Blur opcional, movimento reduzido, seta de última mensagem e alinhamento do botão Enviar estão registrados em [STAGE_7.md](STAGE_7.md).

- **A12: parcial.** Multipart do chat com limite contado e download em stream; backup e cópia no Drive em stream. O ZIP de Projects até 200 MB ainda usa buffers: orçamento global/carga grande ficam para a etapa 8.
- **A13 e A27: implementados e testados em fixture.** Cache curto/deduplicação de refresh com checagem da credencial; conexão canônica reutilizada e migrations fora das leituras repetidas. Microbenchmark limitado, sem promessa de consumo global do notebook.
- **A28: implementado parcialmente.** Polling de Chat/notificações reduzido com realtime e pausado em aba oculta/offline; automação evita manutenção. Ciclo completo de todas as ferramentas depende do ensaio integrado.
- **A29/A30: implementação local.** Saúde sanitizada, diagnóstico privado, integridade dos dois bancos e configuração VAPID; inscrição real de navegador/entrega push permanece na etapa 8.
- **A31: preparação parcial.** Reconexão com rede tardia no cliente; boot real e gerenciador ZimaOS/CasaOS não foram ensaiados nesta etapa.
- **A32: implementado com testes dirigidos.** Pacote criptografado, snapshots coordenados, inventário de arquivos geridos, retenção, chave separada e validação de restore. Drive foi testado com transporte simulado; queda de energia/processo e recuperação na instalação real continuam pendentes.
- **A33: parcial.** Orçamento por socket/usuário no realtime e testes de autorização dirigidos; carga concorrente e limite completo de login são conferências da etapa 8.
- **A34: preparação parcial.** Entradas operacionais empacotáveis verificadas, sem novas dependências. Build Next validado; imagem final, boot e medição total de memória ainda pendentes.

## Complemento de 16/10 — somente etapa 7

Agenda exportável por arquivo .ics, tarefas pessoais e tour guiado da área do usuário implementados localmente; ver [STAGE_7_COMPLEMENT.md](STAGE_7_COMPLEMENT.md). O convite atende também contas antigas e pode ser desligado pelo Admin, com repetição pela Ajuda. As pendências técnicas anteriores da 7 permanecem na 8A e **não foram encerradas**. A 8A depende de novo planejamento dos testes com o usuário; 8B fica para documentação/GitHub e 8C para implantação.
