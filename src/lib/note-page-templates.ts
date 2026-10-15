export const notePageTemplates = ["blank", "lecture", "meeting"] as const;
export type NotePageTemplate = (typeof notePageTemplates)[number];
export function notePageTemplateContent(
  template: string,
  language: string,
): string {
  if (!notePageTemplates.includes(template as NotePageTemplate))
    throw new Error("Escolha um modelo de página.");
  if (template === "blank") return "";
  const en = language === "en";
  return template === "lecture"
    ? en
      ? "## Key ideas\n\n\n\n## Class notes\n\n\n\n## Review\n\n- [ ] Review the concepts\n- [ ] List questions"
      : "## Ideias principais\n\n\n\n## Anotações da aula\n\n\n\n## Revisão\n\n- [ ] Revisar os conceitos\n- [ ] Anotar dúvidas"
    : en
      ? "## Agenda\n\n\n\n## Decisions\n\n\n\n## Next steps\n\n- [ ] Define the next action"
      : "## Pauta\n\n\n\n## Decisões\n\n\n\n## Próximos passos\n\n- [ ] Definir a próxima ação";
}
