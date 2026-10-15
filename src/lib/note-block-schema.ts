import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";

// Shared by browser and server so persisted documents use the same block types.
export const noteBlockSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    quote: defaultBlockSpecs.quote,
    codeBlock: defaultBlockSpecs.codeBlock,
    divider: defaultBlockSpecs.divider,
    table: defaultBlockSpecs.table,
    image: defaultBlockSpecs.image,
  },
});
