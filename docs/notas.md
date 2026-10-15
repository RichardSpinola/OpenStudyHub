# Notas: páginas e trabalho em grupo

Abra **Notas** e clique em **Nova página**. Dê um nome e escolha começar em branco, com anotações de aula ou pauta de reunião. Você pode guardar a página dentro de outra em **Onde guardar**. Disciplina e atividade são opcionais; a página começa privada.

## Escrever e organizar

- Escreva normalmente. Digite `/` para escolher título, lista, checklist, citação, código ou tabela de texto. A seleção de texto mostra opções de formatação.
- Use a alça de um bloco para movê-lo. **Desfazer texto** e **Refazer texto** ficam na barra do editor.
- Crie uma **Nova subpágina** ao final da página. Em **Opções da página**, você pode mover a página, mudar a associação acadêmica, duplicar ou exportar.
- A busca em Notas encontra títulos e conteúdo. A disciplina continua mostrando as notas que você associou a ela.

## Bases em Tabela e Quadro

**Adicionar base** abre a criação: dê um nome, escolha uma base vazia, tarefas ou leituras e a visualização inicial. Os modelos já trazem os campos de prazo ou fonte/data. Tabela e Quadro mostram os mesmos dados. Cada registro tem nome e status: A fazer, Em andamento ou Concluído. Você pode adicionar campos de texto, número, data ou caixa de seleção.

No Quadro, cada coluna tem **Novo registro**; ele já nasce com o status daquela coluna. Arraste pela alça ou escolha o status no próprio cartão. A visualização escolhida fica lembrada neste navegador. As opções de cada campo permitem renomear/remover. Remover registros, campos ou bases pode ser desfeito em **Desfazer título ou base**, enquanto a página estiver aberta. Essa ação de desfazer é separada da edição do texto.

## Imagens

Clique em **Imagem** na barra do editor, escolha o arquivo e confira a prévia. Se quiser, use **Ajustar enquadramento**: arraste a imagem e ajuste o zoom na proporção original, quadrada ou paisagem. Adicione uma legenda e clique em **Inserir na página**. Também é possível colar ou arrastar imagens diretamente para o texto. Depois de inserir, use os controles do bloco para redimensionar, editar a legenda ou remover.

PNG, JPG e WebP são aceitos com até 5 MB e 20 megapixels. A instância reduz imagens grandes para até 2.560 px e remove metadados ao converter para WebP. Cada página permite até 50 imagens e 20 MB, incluindo imagens retidas para o histórico.

As imagens enviadas ficam no banco local e seguem o acesso da nota. Cópias e recuperação no mesmo servidor conservam as imagens. O HTML exportado incorpora as imagens locais para abrir fora do Hub; Markdown e rascunho JSON guardam referências e exigem as imagens disponíveis na instância. Links externos dependem do site de origem. O envio de imagens precisa de conexão com a instância.

## Compartilhar

Em **Compartilhar**, escolha uma pessoa ou um grupo do qual você participa. **Pode ler** é o padrão; escolha **Pode editar** para trabalhar em conjunto. Só o proprietário gerencia acesso, associação, organização e exclusão. Participantes que saem de um grupo perdem o acesso concedido por esse grupo.

Cada subpágina tem suas próprias permissões. Compartilhar a página principal não compartilha automaticamente todas as subpáginas.

A edição colaborativa usa sincronização periódica: as alterações são enviadas após uma pequena pausa e as alterações de outras pessoas aparecem em aproximadamente cinco segundos com a página ativa. Esta entrega não mostra os cursores de outros participantes.

## Salvamento e recuperação

**Salvo** significa que o servidor confirmou a alteração. Durante uma queda de conexão, uma página já aberta permite continuar escrevendo e mantém um rascunho no navegador, quando o armazenamento local está disponível. Não limpe os dados do site antes de recuperar o trabalho.

Ao voltar a conexão, ou reabrir a página com o servidor disponível, o rascunho é combinado com a versão salva. Se o navegador não permitir manter rascunhos, o aviso orienta baixar uma cópia.

- **Baixar rascunho de recuperação** exporta um JSON com texto, bases e estado da edição, inclusive alterações ainda sem confirmação.
- **Importar página**, na entrada de Notas, aceita esse JSON, Markdown ou texto. A importação cria uma página privada separada.
- Em **Opções da página → Histórico e recuperação**, versões recentes podem ser recuperadas como cópias privadas. São guardadas até 15 versões, com intervalo mínimo de 30 segundos entre capturas; não há uma versão por tecla digitada.
- A exclusão da página exige confirmação escrita e é permanente. As subpáginas são mantidas.

As notas ficam no banco local da instância e funcionam sem Google. Esta etapa não cria um espelho automático de cada nota no Drive. Os dados fazem parte do backup do banco; a conferência integrada de restauração está prevista nas etapas 7 e 8.

## Limites desta entrega

Até 100 mil caracteres, 2.500 blocos e 1,5 MB de estado colaborativo por página. As bases permitem até 12 coleções, 20 campos e 300 registros por coleção. Fórmulas, relações entre bases e anexos de outros tipos não fazem parte desta etapa; esses arquivos continuam na Biblioteca.

O editor usa [BlockNote](https://www.blocknotejs.org/docs) e [Yjs](https://github.com/yjs/yjs), com créditos em **Configurações → Sobre → Créditos**. Não utiliza código do AppFlowy ou do Notion.
