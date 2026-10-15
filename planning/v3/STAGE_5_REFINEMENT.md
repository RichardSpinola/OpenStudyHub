# Etapa 5 — refinamento de páginas, bases, imagens e créditos

Revisão de 15/10/2026, exclusivamente no código V3 e na instância local de QA com dados fictícios.

## Entrega

- **Nova página / Nova subpágina:** nome, ponto de partida (branco, anotações de aula ou reunião), página principal e associação opcional à disciplina. Erros preservam o formulário. No celular, o botão Páginas abre a navegação em uma janela própria.
- **Bases:** criação com nome, modelos Tarefas/Leituras, escolha inicial Tabela/Quadro e visualização lembrada no navegador. Novo registro em cada coluna recebe o status correspondente. Campos são criados e editados em janelas próprias.
- **Imagens:** envio no editor, prévia, legenda, enquadramento por arraste/zoom e suporte do editor a colar/arrastar. PNG/JPG/WebP até 5 MB e 20 megapixels; normalização para WebP até 2.560 px, sem metadados. Limite por página de 50 imagens/20 MB, incluindo histórico.
- Imagens no banco local, protegidas pelo acesso à nota; cópias e recuperação preservam referências autorizadas. HTML exportado incorpora os arquivos locais. Markdown e JSON guardam referências, sem um pacote portátil de imagens.
- **Configurações → Sobre → Créditos:** nome substitui Software de terceiros e reúne Excalidraw, BlockNote e Yjs. A página de licenças detalhadas também se chama Créditos.
- Migração aditiva 0019 e matriz de importação com as duas novas tabelas opcionais para instalações anteriores. Backups privados dos dois bancos QA feitos antes da migração.

## Verificação técnica

27 testes dirigidos aprovados em cinco arquivos, um worker por vez: workspace, imagens, provider de sincronização, hierarquia de notas e compatibilidade da fundação/importador. Incluem:

- Leitura/edição/revogação e recusa de upload por leitores.
- Recusa de formatos forjados, excesso de tamanho/pixels e limite por página.
- Imagens em cópias, recuperação e exportação HTML; rascunho de outra pessoa não concede acesso a uma imagem privada.
- Remoção do arquivo apenas quando a última nota que o referencia é excluída, em banco descartável.
- Recusa de URL executável em um estado colaborativo adversarial. A montagem do teste foi corrigida para inserir o bloco no documento existente, sem depender da ordem de mesclagem de documentos independentes.
- Primeira abertura de Markdown antigo com links relativos sem reescrever o texto original.

Lint dos arquivos alterados aprovado. Compilação final aprovada, incluindo TypeScript, em 41,3 s; pico de 1,6 GiB e 64 KiB de swap. As três prévias foram pausadas durante a compilação, depois reabertas em 3090/3091/3092 com os limites de memória anteriores.

A revisão também corrigiu a prévia após recorte para que um segundo enquadramento use a imagem já recortada e limpou o formulário após criar uma página, evitando reaproveitar o título anterior.

## Percurso na tela

Somente conta e conteúdo fictícios, sem alterar as notas de teste criadas pelo usuário:

1. Enviar página sem nome pediu preenchimento. Criar Anotações de aula gerou as seções e checklist esperados.
2. Base sem nome pediu preenchimento. Modelo Tarefas trouxe Prazo, abriu em Quadro e Novo registro em Em andamento recebeu esse status.
3. Criar Referência abriu a janela de campo e mostrou o campo no registro. Alternar para Tabela conservou nome, status e campos.
4. Arquivo de texto no seletor de imagens mostrou erro e manteve Inserir desativado. PNG válido mostrou prévia, legenda e enquadramento; zoom aplicado e imagem inserida.
5. Após recarregar, imagem carregada, legenda, registro e campo continuaram salvos. O navegador confirmou Salvo.
6. Nova subpágina abriu com a principal correta; a criação mostrou a hierarquia e o caminho de retorno.
7. Em 390 × 844, seletor Páginas abriu e a largura global permaneceu em 390 px; a tabela conserva rolagem própria.
8. Configurações/Sobre mostrou Créditos com Excalidraw e as referências de Notas no mesmo bloco.
9. Na compilação final, o recorte quadrado atualizou a prévia de 800 × 400 para 400 × 400; reabrir o enquadramento usou essa imagem atualizada. Nenhuma segunda imagem foi enviada nesse reteste.

A revisão não cobre Google/Drive reais, publicação ou o checkpoint integrado das etapas 7/8. Imagens exigem conexão para envio; o rascunho não é um backup portátil dos arquivos.

## Evidências

- [Editor com imagem](evidence/stage5-refinement-editor.png).
- [Créditos](evidence/stage5-refinement-credits.png).
- [Páginas em tela pequena](evidence/stage5-refinement-pages-mobile.png).
