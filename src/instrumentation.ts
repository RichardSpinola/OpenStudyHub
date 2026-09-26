export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.OPENSTUDYHUB_V2_ENABLED !== "1"
  )
    return;
  const state = globalThis as typeof globalThis & {
    __openStudyHubGoogleAutomation?: ReturnType<typeof setInterval>;
  };
  if (state.__openStudyHubGoogleAutomation) return;
  const { withV2DbAsync } = await import("./lib/v2/runtime-database");
  const { runDueGoogleAutomation } = await import("./lib/v2/google-automation");
  const { runGoogleHealthChecks } = await import("./lib/v2/google-health");
  const tick = () => {
    void withV2DbAsync(async (db) => {
      await runGoogleHealthChecks(db);
      await runDueGoogleAutomation(db);
    }).catch(() => {
      // Only sanitized statuses are persisted; a later tick retries.
    });
  };
  state.__openStudyHubGoogleAutomation = setInterval(tick, 60_000);
  state.__openStudyHubGoogleAutomation.unref();
  setTimeout(tick, 10_000).unref();
}
