export function validateSetupStep(
  step: number,
  v: Record<string, string>,
): string | null {
  const required =
    [
      ["institution", "language", "timeZone"],
      ["login", "name", "password", "confirmPassword"],
      [
        "program",
        "code",
        "shift",
        "cohort",
        "period",
        "startsOn",
        "endsOn",
        "semesters",
      ],
      [],
    ][step] ?? [];
  if (required.some((k) => !v[k]?.trim()))
    return "Preencha os campos obrigatórios para continuar.";
  if (step === 0) {
    if (v.institution.trim().length > 160)
      return "Use até 160 caracteres para o nome da instituição.";
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: v.timeZone });
    } catch {
      return "Escolha um fuso horário válido.";
    }
  }
  if (step === 1) {
    if (!/^[a-z0-9._-]{3,64}$/i.test(v.login))
      return "O login deve ter entre 3 e 64 letras, números, pontos, traços ou sublinhados.";
    if (v.name.trim().length < 2)
      return "Informe um nome com pelo menos 2 caracteres.";
    if (v.password.length < 12)
      return "Use uma senha com pelo menos 12 caracteres.";
    if (v.password !== v.confirmPassword)
      return "As duas senhas precisam ser iguais.";
  }
  if (step === 2) {
    const validDate = (s: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      !Number.isNaN(Date.parse(s + "T12:00:00Z")) &&
      new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
    if (
      !validDate(v.startsOn) ||
      !validDate(v.endsOn) ||
      v.startsOn >= v.endsOn
    )
      return "Confira as datas: o fim do período deve vir depois do início.";
    const n = Number(v.semesters);
    if (!Number.isInteger(n) || n < 1 || n > 20)
      return "Informe de 1 a 20 semestres completos para o curso.";
  }
  return null;
}
