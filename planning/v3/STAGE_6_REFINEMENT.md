# Refinamento visual da etapa 6

Pedido posterior à entrega `b24a86e`. Revisão local; não inicia a etapa 7.

## Mudanças

- Foco, Flashcards e cada jogo usam uma área própria com barra compacta de saída para Extras/catálogo e Home. A navegação global não se repete nessas telas, seguindo a base imersiva do Quadro Branco. Formulários e listas longas de flashcards mantêm rolagem útil dentro da área de trabalho.
- Jogos têm tabuleiro dimensionado pela janela e ajuste proporcional do conjunto de controles, tabuleiro e resultados. O ajuste observa mudanças de resolução e de conteúdo; não apenas esconde o excesso. Campo Minado perdeu a largura mínima que forçava transbordamento. Ajuda abre em diálogo, sem aumentar a tela da partida.
- Gráficos de casas/cartas e Quatro em Linha receberam profundidade discreta; Foco/Flashcards usam prévias gráficas com a mesma base dos outros cartões de Extras.
- Som de vitória foi movido para Configurações → Personalização → Aparência e Home → Celebração nos jogos. Conserva a preferência existente por conta/navegador, começa desligado e salva automaticamente. Os jogos apenas leem a preferência. Confete passou de 18 para 72 partículas, com duração breve e respeito a redução de movimento.
- Chat recebeu lista lateral mais clara, criação/busca compactas, conversa selecionada destacada, balões próprios à direita, horário compacto com data completa no título e compositor compacto. Formatação e anexos ficam em “+”, com as ações existentes preservadas. Menus de mensagem, perfil e compositor usam fechamento ao clicar fora/Escape.
- Prévias dos quatro jogos novos, Foco e Flashcards usam o mesmo componente/base dos cinco jogos originais. O botão Pomodoro reutiliza a classe e o ícone no padrão das notificações, com contagem compacta sobreposta.
- Chat aceita um arquivo por mensagem, por seleção ou arrastar/soltar. PNG/JPEG/WebP têm prévia e validação até 5 MiB; demais arquivos são privados, até 20 MiB e baixados como binário. Nome original é persistido por migração aditiva `0021_chat_files`; imagens antigas continuam legíveis. Permissões são revalidadas no armazenamento e na leitura; inserir o anexo gera revisão para as outras contas.
- Corpo multipart tem limite real de bytes, mesmo sem Content-Length. Transporte do proxy é configurado para 21 MiB, compatível com arquivo de 20 MiB mais campos. O arquivo não é enviado ao soltar: há seleção para revisão antes do clique em Enviar.

## Verificação

Lint e TypeScript aprovados. O build final dos componentes foi aprovado com pico de 1,9 GiB e prévias pausadas. Nove testes dirigidos passaram: quatro de anexos novos, quatro de histórico/privacidade do Chat e um de compatibilidade das imagens antigas. A migração foi aplicada somente ao QA, após backup consistente.

No primeiro build da revisão, os nove jogos couberam em 390 × 844; Campo Minado avançado e Memória 4 × 6 foram conferidos com conteúdo. Ajuda abriu/fechou, Flashcards mostrou pergunta/resposta, Foco conservou tempos, som persistiu após recarregar e formatação do Chat funcionou. Foram corrigidos texto de ajuda duplicado, controle de bandeira e borda Legacy encontrados nessa revisão.

A tentativa de recompilação foi inicialmente bloqueada por limite da revisão automática; depois do pedido para continuar a revisão voltou a funcionar e o build foi concluído. A aba ficou em tela interna de erro durante a pausa. Após o usuário reabrir o Chat, a conferência final pôde continuar.

No navegador: clicar fora fechou o compositor; arquivo vazio foi recusado; seleção de TXT mostrou nome/tamanho antes do envio; TXT foi enviado e baixado com bytes idênticos ao original. Um arquivo fictício de 11 MiB foi enviado, validando o transporte acima do limite anterior de 10 MiB. PNG público do próprio aplicativo mostrou prévia e foi enviado como imagem. Os controles preservaram o rascunho no erro de validação. O teste encontrou perda da posição no fim após a imagem carregar; a ancoragem foi corrigida para distinguir rolagem do usuário de mudanças de layout, e o reteste confirmou distância do fim menor que 1 px após envio/carregamento da imagem. Ao rolar para leitura anterior e abrir detalhes, a distância se manteve (~93 px), sem salto para o fim.

No build final, os nove jogos também couberam na janela baixa: a resolução nominal 1024 × 600 correspondeu a 788 × 461 pixels CSS no navegador com zoom do usuário, medidos no DOM. A borda inferior de cada jogo ficou dentro desses 461 px; não houve largura global excedente. O ajuste temporário foi removido. Pomodoro e notificações apresentaram dimensões iguais de botão e a mesma classe de estilo. Clique fora e Escape fecharam os menus de mensagem/compositor. Compilação final incluindo a correção de rolagem: 52,4 s, pico de 1,8 GiB e 4,8 MiB de swap no serviço, sem outra tarefa pesada concorrente.

O gesto real de arrastar arquivo do desktop não foi automatizado: o caminho de seleção/envio foi executado com seletor de arquivos, e os handlers de arrastar/soltar foram inspecionados. Não se declara esse gesto como testado no navegador.

## Limites

Em janelas extremamente pequenas, ajustar um tabuleiro grande inteiro exige reduzir os alvos e textos. Não há promessa de legibilidade idêntica em todas as dimensões. O ajuste não altera regras ou dados dos jogos.

O som usa o áudio do navegador; reprodução efetiva também depende de política de reprodução, volume e dispositivo. Não foi acrescentada notificação do sistema nem áudio em segundo plano.

Etapa 7 permanece planejada em [STAGE_7_PLAN.md](STAGE_7_PLAN.md).

## Resultado

Revisão concluída localmente, com conferência dirigida aos pontos alterados. Os limites acima permanecem explícitos. Nenhuma alteração aplicada à produção ou ao GitHub.
