import { expect, it } from "vitest";
import { withPasswordBudget } from "./password-budget";

it("bounds simultaneous password work and waiting requests, including failures", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let running = 0,
    peak = 0,
    executed = 0;
  const requests = Array.from({ length: 11 }, (_, index) =>
    withPasswordBudget(async () => {
      running++;
      peak = Math.max(peak, running);
      executed++;
      try {
        await gate;
        if (index === 0) throw new Error("simulated failure");
        return index;
      } finally {
        running--;
      }
    }),
  );
  const results = Promise.allSettled(requests);
  expect(running).toBe(2);
  release();
  const done = await results;
  expect(peak).toBe(2);
  expect(executed).toBe(10);
  expect(done.filter((r) => r.status === "rejected")).toHaveLength(2);
  await expect(withPasswordBudget(async () => "recovered")).resolves.toBe(
    "recovered",
  );
});
