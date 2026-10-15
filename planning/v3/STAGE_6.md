# Etapa 6 — Chat, nove jogos e estudo

Entrega única solicitada pelo usuário. Código V3 e QA local com contas fictícias. Produção, secrets Google e publicação no GitHub permanecem fora desta entrega.

## Implementação

### Chat e administração

- Lista/conversa preservadas nos dois temas; ações recolhidas em menu sobreposto. Editar continua embutido; responder, editar e denunciar fecham o menu para não cobrir o formulário. Exclusão do próprio autor tem confirmação na interface.
- Abertura nas 50 mensagens recentes, histórico anterior paginado, retorno ao presente e janela de até 200 mensagens no cliente. Leitura anterior preserva posição; recebimento não arrasta quem está lendo o histórico.
- Log de mudanças por sala, cursor de revisão e exclusões propagadas. GET existente com `after` continua compatível; `sync`/`since` e `before` acrescentam sincronização e paginação. Editar/excluir revalida participação na conversa. Polling fica suspenso quando o documento está oculto; reconexão retoma pelo cursor.
- O criador do Global deixa de ter autorização implícita para mudar a foto. Na arquitetura V3, o Admin usa sessão administrativa separada: **Admin → Extras → Chat Global · imagem**, com enquadramento, validação do arquivo e restauração do ícone. A ação exige Admin ativo e gera auditoria.
- Moderação respeita o escopo das salas institucionais. Denúncia voluntária copia apenas o texto selecionado e o motivo. O Admin vê Global e denúncias em `/control/chat`; não ganha navegação livre nas DMs. Anexos não são copiados à denúncia.

### Jogos

- Catálogo com Snake, 2048, Campo Minado, Paciência, Dominó, Memória, Sudoku, Quatro em Linha e Jogo da Velha.
- Removido o cálculo de largura baseado na altura restante que encolhia tabuleiros em telas baixas. Estrutura comum com ajuda contextual recolhível, controles legíveis e som opcional desligado inicialmente. Animação de vitória respeita redução de movimento.
- Campo Minado grande mantém células legíveis e rolagem dentro do tabuleiro. Paciência mantém as sete colunas; Dominó mantém a mão/mesa próprias e simplifica a espera pelo convite.
- Memória permite três tamanhos. Sudoku usa catálogo verificado de solução única com três dificuldades e variação por renumeração, anotações e conferência. Quatro em Linha e Jogo da Velha aceitam computador ou duas pessoas no mesmo aparelho. Não foi acrescentado outro multiplayer online.
- Recordes de Snake/2048 e dos jogos novos são separados por usuário/navegador. Preferência de som também é pessoal. Snake pausa na ocultação; Dominó não continua consultando partida com o documento oculto.

### Estudo e Biblioteca

- **Foco:** Pomodoro 25/5/15 ajustável, pausa/retomada, conclusão sem iniciar a fase seguinte automaticamente, pausa longa após quatro estudos. Indicador junto das notificações nas duas navegações. Cronômetro com até 100 voltas. Horários persistidos por conta no navegador evitam deriva após navegação/recarregamento; não há notificação do sistema.
- **Flashcards:** baralhos privados, disciplina opcional, perguntas/respostas em texto, edição e arquivo/restauração. Revisão frente/verso, Já sei/Rever novamente, fila e resumo. Até 500 cartões por baralho.
- Compartilhamento de baralhos para leitura com pessoas e grupos atuais. Só o dono edita; progresso individual fica no banco. Início de revisão verifica novamente acesso e conteúdo; resposta recusada encerra a revisão local. Revogação e saída do grupo impedem novas operações.
- Projetos arquivados foi movido para a lateral Conteúdos da Biblioteca.
- Novos recursos e jogos controlados por flags no Admin; rotas, APIs e modo de prova conferem os bloqueios no servidor. Quadro Branco preservado, com a mesma verificação de modo de prova na leitura HTTP.

## Dados e compatibilidade

Migração aditiva `0020_chat_study_tools` no banco App: log do Chat, denúncias, baralhos/cartões, compartilhamentos e progresso. `0030_study_tools` no banco canônico adiciona flags; o estado anterior dos recursos existentes é mantido. Matriz do importador atualizada para 66 tabelas, com tabelas V3 opcionais na origem antiga. Nenhuma migration anterior foi alterada. Backups privados e consistentes dos dois bancos QA precederam a aplicação.

## Verificação técnica

44 testes dirigidos aprovados em 12 arquivos, um worker por vez: regras dos nove jogos, tabuleiros Sudoku de solução única, robôs, relógios/recarregamento, limites de corpo, isolamento/compartilhamento/progresso/arquivo dos flashcards, histórico/revisões/exclusões do Chat, foto global, denúncia limitada à mensagem e compatibilidade do importador/flags. Os 11 testes de Chat, flashcards e Extras foram repetidos após ajustes e passaram. Lint dos arquivos alterados passou.

Compilação inicial aprovada com TypeScript, 70,1 s, pico de 2 GiB; as prévias ficaram pausadas. Compilação final aprovada com TypeScript em 39,7 s, pico de 1,8 GiB e 2,4 MiB de swap no serviço de build. O resultado final foi aplicado apenas às prévias locais. As três prévias possuem limites de memória; a aba extra de testes foi fechada e o ajuste temporário de resolução foi removido.

## Percurso de uso

Executado com Estudante A/B e Admin Fictício, sem alterar notas ou projetos pessoais do usuário:

- Nome de baralho e cartão vazios foram bloqueados; criação livre e cartão de DNS concluídos.
- Compartilhamento apareceu em B, sem edição. B mostrou resposta, repetiu o cartão e concluiu a sessão. Arquivar/restaurar manteve conteúdo.
- O teste encontrou revisão iniciada a partir de conteúdo já carregado após revogação; corrigido para consultar novamente acesso e conteúdo antes de iniciar. Repetido no build final: A compartilhou, B abriu, A revogou e B recebeu “Baralho indisponível. Confira seu acesso”, sem iniciar revisão.
- Pomodoro/cronômetro continuaram durante navegação; pausa, volta e recarregamento conservaram os valores. Ajustada a atualização imediata do horário ao clicar para evitar uma contagem visual temporariamente maior.
- Envio e primeira edição do Chat concluídos. O teste encontrou o menu cobrindo o formulário na segunda edição; corrigido fechando as ações ao escolher responder/editar/denunciar. No build final, a segunda edição foi salva e apareceu em B sem recarregar a página. B enviou uma denúncia fictícia, o Admin recebeu a mensagem e o motivo e encerrou sem remover conteúdo.
- Jogo da Velha concluído com vitória; Quatro em Linha recebeu resposta do computador; Memória mostrou duas cartas e uma tentativa; Sudoku destacou erro de preenchimento.
- 2048 moveu e desfez; Campo Minado abriu a primeira casa e marcou bandeira; Paciência comprou uma carta e liberou Desfazer; Dominó criou convite, recebeu segunda conta e registrou a primeira peça.
- Conferidos Admin → Extras com os nove jogos e novas ferramentas, acesso à foto global e painel de denúncias. A permissão da foto foi verificada tecnicamente; o envio/enquadramento da foto global não foi executado no navegador nesta rodada.
- Quadro Branco abriu com ferramentas e estado “Conectado · alterações salvas automaticamente”. Não foi feito novo ensaio de desenho colaborativo.
- Material conferido em 768 px, com catálogo sem transbordamento horizontal e ferramentas de Foco visíveis. Iniciar Pomodoro exibiu 25:00 imediatamente; foi pausado ao terminar. Legacy conferido no desktop e nas larguras móveis acima.
- Em 390 × 844, Memória, Sudoku, Quatro em Linha, Snake, 2048, Campo Minado e Paciência mantiveram largura global de 390 px. A primeira captura chamada mobile era de desktop por o ajuste de viewport afetar a outra aba; a dimensão real foi conferida antes das capturas móveis finais.

## Limites e próxima etapa

Flashcards sem imagens/IA/repetição espaçada. Temporizadores e recordes locais não migram entre aparelhos. Não foi feito teste de carga nem ensaio Google/Drive real. Exclusões definitivas são verificadas em banco descartável; a revisão no navegador evita apagar conteúdo existente. O Quadro Branco não recebeu redesign. Backup integrado, desempenho geral, idioma e **blur opcional desligado inicialmente** continuam na etapa 7.

## Resultado

Etapa concluída localmente como uma entrega. Os problemas encontrados no percurso foram corrigidos e os fluxos afetados foram repetidos no build final. Permanecem os limites declarados acima, sem afirmar validação Google real, carga ou vitória manual em todos os jogos.

Guia: [Chat e Extras](../../docs/chat-e-extras.md).
