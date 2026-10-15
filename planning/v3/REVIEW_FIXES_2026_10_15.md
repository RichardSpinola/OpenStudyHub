# Revisão antes da etapa 5 — 15/10/2026

Ajustes solicitados na revisão visual da etapa 4. Mantém os temas existentes e o Admin aprovado. Produção e credenciais Google reais não foram usadas.

## Mudanças

- **Grade semanal:** tabela compacta inspirada no portal enviado pelo usuário. Uma linha por intervalo real cadastrado, horários de início e fim na primeira coluna, dias nas demais. Não cria linhas de meia hora vazias nem aumenta cartões conforme duração. Aulas simultâneas permanecem legíveis em itens separados. Detalhes continuam acessíveis ao clicar. Seletor de dia apenas em telas pequenas.
- **Disciplinas:** cabeçalho de outros períodos e seu botão menores, preservando a organização por períodos.
- **Projetos:** abas com estilo e seleção visível; envio e arquivos alinhados no mesmo workspace; cabeçalho mais compacto. Menu de três pontos usa diálogo sobreposto e limitado à janela, em vez de conteúdo preso ao cartão. Corrigido o link de versões e o estado de projetos locais, que dizia “No Drive”. Arquivar fica visível nesse menu e pode ser restaurado.
- **Exclusão definitiva:** dono precisa digitar o nome exato do projeto. Remove arquivos locais e versões ou a pasta exclusiva do projeto no Drive; elimina registros e compartilhamentos. Projetos arquivados também oferecem exclusão. Bloqueia envio ativo e referências compartilhadas/raízes reconhecidas. Falha do Drive preserva os metadados para nova tentativa. Não remove a raiz da instituição ou do curso.
- **Enquadramento:** componente comum de arrastar/zoom para capas, imagens dos atalhos, fundos Home/Chat e fotos de grupos/conversas. Perfil conserva seu editor existente; wallpaper também conserva o ajuste de posição/zoom já disponível. Arquivos e anexos de conteúdo não são recortados automaticamente.
- **Wallpaper:** remove a reserva lateral da barra de rolagem apenas na Home; a imagem usa toda a largura do canvas.

## Conferência

- 14 testes direcionados passaram em quatro arquivos: grade, geometria de enquadramento, projetos locais e exclusão definitiva.
- Exclusão testada em banco/arquivos temporários: dono/nome, envio ativo, arquivos e histórico locais, preservação de outro projeto, Drive sintético com falha e nova tentativa e pasta não exclusiva.
- Tipos passaram antes da compilação; lint dos arquivos alterados corrigido. Compilação com otimização de memória passou após ajustar o teto. O teste visual encontrou e corrigiu o ancoramento do botão de opções e a barra de rolagem da Home; o build de fechamento inclui esses ajustes.
- Nenhum projeto do usuário foi excluído pelo agente na interface. Exclusão Google real continua pendente do ensaio da etapa 8.

## Recursos

Prévia pausada durante a compilação. A primeira tentativa, com teto de 1800 MiB, foi encerrada pelo limite de memória. A nova tentativa usa um worker, heap de 1024 MiB, otimização de memória do Webpack, teto de 2304 MiB e swap de 128 MiB. Testes direcionados com apenas um worker, sem executar junto do build.

## Referência técnica

[Google Drive files.delete](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/delete): operação de exclusão permanente utilizada apenas para a pasta exclusiva registrada do projeto, após autorização e confirmação de nome no Hub.

## Conferência pela interface

- Grade com cinco aulas em cinco intervalos reais: tabela com 382 px de altura na largura de 1280 px, títulos e locais legíveis, sem transbordamento horizontal.
- Detalhe do projeto: abas separadas, arquivos e envio lado a lado em desktop, em uma coluna em telas menores.
- Recorte de capa: seleção de arquivo fictício, zoom, ajuste pelo teclado, aplicação à prévia; o teste foi cancelado antes de salvar a capa do usuário.
- A revisão conferiu as opções de exclusão sem acionar uma exclusão definitiva pela interface. Casos positivos de exclusão foram executados apenas em bancos e arquivos descartáveis dos testes.

## Fechamento

- Compilação final aprovada em aproximadamente 40 segundos, pico de 1,5 GiB. Houve novas compilações sequenciais para corrigir o ancoramento do botão e a faixa real da barra de rolagem encontrados na conferência visual. As prévias ficaram pausadas durante as compilações.
- Menu de projetos conferido: diálogo entre y=143 e y=577 em janela de 720 px, sem precisar rolar a página para alcançar suas opções. A seção de exclusão explica o efeito e pede o nome exato.
- Wallpaper conferido: largura do canvas e largura útil do conteúdo iguais a 1272 px; borda direita da imagem e do conteúdo iguais. A Home mantém rolagem por toque/teclado/roda, sem reservar uma faixa para o indicador visual.
- Grade conferida em 1280 e 390 px, sem transbordamento horizontal. Tamanho normal do navegador restaurado.
- Nenhuma foto pessoal do usuário foi incluída nos arquivos deste relatório. As capturas abaixo usam somente os dados fictícios da prévia.

### Capturas

- [Grade compacta](evidence/review-2026-10-15-weekly.png).
- [Projeto](evidence/review-2026-10-15-project.png).
- [Menu sobreposto](evidence/review-2026-10-15-options.png).
