# Etapa 5 — Notas

## Escopo

Workspace de páginas e subpáginas, editor por blocos, compartilhamento para leitura/edição e bases simples Tabela/Quadro. Identidade Material/Legacy e demais áreas aprovadas preservadas. Implementação local, sem deploy, Google real ou publicação no GitHub.

## Base e créditos

- BlockNote 0.56.0 (MPL-2.0) para edição de blocos e Yjs 13.6.33 (MIT) para convergência. Não foi usado código do AppFlowy/Notion.
- UI Ariakit, carregamento apenas na página de edição; fontes herdadas do Hub. Código original dos pacotes sem modificação.
- `THIRD_PARTY_NOTICES.md`, `/credits`, Configurações/Sobre e cópias em `public/licenses/`.
- Dependências da V3 em pasta isolada; dependências da V2 preservadas. Lockfile fixado mantendo as versões anteriores do projeto.

## Implementação

- `/notes`: árvore lateral, busca por título/conteúdo, grade/lista com as prévias gráficas mantidas, criação livre ou associada à disciplina e importação Markdown/texto/rascunho JSON.
- Editor: títulos, listas/checklists, citações, código, tabelas, separadores, formatação, menu `/`, movimentação de blocos e desfazer/refazer.
- Subpáginas privadas por padrão, mudança de página principal com validação de proprietário/ciclos. Excluir a principal mantém as subpáginas independentes.
- Permissões explícitas de leitura/edição com pessoas e grupos. Só o dono organiza, associa, altera acesso ou exclui. Subpáginas não herdam acesso automaticamente.
- Bases: registros com nome/status, campos texto/número/data/checkbox, tabela/quadro com os mesmos dados, arraste e alternativa por seletor de status. Desfazer próprio para título/bases.
- Estado Yjs persistido no SQLite; Markdown derivado para busca/prévias/exportação. Migração de notas Markdown ocorre uma única vez no primeiro acesso; chamadas do editor antigo não sobrescrevem um workspace migrado.
- Provider HTTP com debounce, confirmação do servidor, fila única, envio incremental e consulta a cada 5 s quando a página está ativa. Sem cursores/presença nesta entrega. Rascunho IndexedDB e recuperação após nova abertura, além de exportação JSON de emergência.
- Até 15 versões anteriores, com intervalo mínimo de 30 s. Recuperar cria cópia privada.
- Autorização e modo de prova conferidos nas ações e API. Verificação da origem usa o Host de destino; a URL interna do Next pode ter hostname diferente.

## Verificação

30 testes dirigidos aprovados em 6 arquivos, com um worker por vez: migração/compatibilidade, edição simultânea no mesmo parágrafo, idempotência/reabertura, leitores/revogação, células independentes, cópia histórica/importação de rascunho, ciclos de subpáginas, payload corrompido, origem das requisições e confirmação de salvamento. Os dois testes do provider cobrem falha de rede e digitação nova durante um envio anterior. Lint passou. A compilação inclui conferência TypeScript.

Compilação final aprovada em 43,7 s, com pico de 1,8 GiB e um worker. Prévias locais pausadas durante a compilação e reabertas com limites de 512 MiB para cada superfície e 256 MiB para realtime.

Percurso no navegador, exclusivamente com dados e contas fictícios:

- Criação vazia pede título; depois cria uma página livre sem obrigar disciplina.
- Texto, checklist pelo menu `/`, registro e status; Tabela/Quadro mostram o mesmo registro.
- Rascunho resistiu ao erro de origem e à pausa/reinício da prévia. Salvamento confirmado e conteúdo/base presentes após recarregar.
- Estudante B abriu em somente leitura; após atualizar a permissão, editou o registro. Estudante A recebeu a alteração.
- Subpágina criada, renomeada e exibida na navegação e na página principal.
- Campo vazio bloqueado pela validação do formulário; criação de campo de data concluída.
- Histórico aberto e versão recuperada como nova cópia, mantendo o conteúdo anterior.
- Conferência responsiva em 390 × 844; título longo encontrado cortado, ajustado e reconferido completo em duas linhas, sem rolagem interna no título. Temas Material e Legacy conferidos.
- Exportação Markdown baixada pelo menu, contendo título, texto, checklist e registros da base. O código interno de status encontrado no arquivo foi substituído pelo rótulo legível; os 8 testes de workspace foram repetidos após o ajuste e passaram.

O percurso encontrou e corrigiu a comparação de origem com o endereço interno do Next. Também foram ajustadas variáveis de superfície/texto dos temas. Conferência não equivale a testes Google reais nem ao checkpoint integrado de todas as áreas. Exclusão definitiva foi coberta em banco descartável nos testes técnicos; não foi acionada no navegador.

## Refinamento após a revisão

[STAGE_5_REFINEMENT.md](STAGE_5_REFINEMENT.md): modelos de páginas, fluxo das bases, imagens com enquadramento e créditos reunidos em Configurações.

## Limites

Notas permanecem locais no banco da instância. Não há espelho automático de cada nota no Google Drive. Bases sem fórmulas/relacionamentos; imagens embutidas foram adicionadas no refinamento, e os demais anexos continuam na Biblioteca. A edição sem rede cobre páginas já abertas; abrir o App inteiro sem servidor não é um modo offline completo.

A integração de backup/restore completo segue nas etapas 7/8.

## Evidências visuais

- [Editor no Material](evidence/stage5-material-desktop.png).
- [Material em 390 × 844](evidence/stage5-material-mobile.png).
- [Editor no Legacy](evidence/stage5-legacy-desktop.png).

## Referências

- [Integração React e Next.js](https://www.blocknotejs.org/docs/getting-started/nextjs).
- [Colaboração Yjs](https://www.blocknotejs.org/docs/features/collaboration).
- [Conversão de blocos no servidor](https://www.blocknotejs.org/docs/features/server-processing).
- [Licença BlockNote](https://github.com/TypeCellOS/BlockNote/blob/v0.56.0/packages/core/LICENSE).
