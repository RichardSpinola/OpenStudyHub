# Software de terceiros

## Editor de Notas (etapa 5)

A organização de páginas, permissões, sincronização HTTP, recuperação e bases é uma implementação do OpenStudyHub. O editor usa bibliotecas livres; não incorpora o código do AppFlowy nem do Notion.

- **BlockNote 0.56.0**, TypeCell/colaboradores: `@blocknote/core`, `@blocknote/react`, `@blocknote/ariakit` e `@blocknote/server-util`, MPL-2.0. [Código e avisos originais](https://github.com/TypeCellOS/BlockNote/tree/v0.56.0/packages), [licença distribuída](public/licenses/blocknote-MPL-2.0.txt). Consumido como dependência, sem alterações aos arquivos originais. Os fontes correspondentes estão nos pacotes publicados e no repositório do projeto.
- **Yjs 13.6.33**, Kevin Jahns e colaboradores, MIT: [fonte](https://github.com/yjs/yjs), [licença e copyright](public/licenses/yjs-MIT.txt).
- **y-prosemirror 1.3.7**, **y-protocols 1.0.6** e **y-indexeddb 9.0.12**, Kevin Jahns e colaboradores, MIT: [y-prosemirror](https://github.com/yjs/y-prosemirror), [y-protocols](https://github.com/yjs/y-protocols), [y-indexeddb](https://github.com/yjs/y-indexeddb). Cópias dos avisos acompanham `public/licenses/`.

Os manifests e o lockfile mantêm a identificação das demais dependências transitivas. Seus avisos originais permanecem nos pacotes distribuídos. Esta lista destaca as bibliotecas da entrega de Notas e não substitui as licenças individuais.

## Quadro Branco

Excalidraw 0.18.1, MIT. [Código, licença e créditos](https://github.com/excalidraw/excalidraw/tree/v0.18.1).
