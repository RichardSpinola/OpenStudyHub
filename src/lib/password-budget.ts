// Bound Argon2 memory per process, including bursts against different accounts.
const activeLimit = 2;
const queueLimit = 8;
const runtime = globalThis as typeof globalThis & {
  oshPasswordBudget?: { active: number; waiting: Array<() => void> };
};
const budget = (runtime.oshPasswordBudget ??= { active: 0, waiting: [] });

export async function withPasswordBudget<T>(
  work: () => Promise<T>,
): Promise<T> {
  if (budget.active >= activeLimit) {
    if (budget.waiting.length >= queueLimit)
      throw new Error(
        "Muitas tentativas simultâneas. Aguarde e tente novamente.",
      );
    await new Promise<void>((resolve) => budget.waiting.push(resolve));
  } else budget.active++;
  try {
    return await work();
  } finally {
    const next = budget.waiting.shift();
    if (next) next();
    else budget.active--;
  }
}
