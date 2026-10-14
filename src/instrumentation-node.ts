import { withV2DbAsync } from "./lib/v2/runtime-database";
import { runDueGoogleAutomation } from "./lib/v2/google-automation";
import { runGoogleHealthChecks } from "./lib/v2/google-health";
export function registerNodeAutomation() {
  const state = globalThis as typeof globalThis & {
    __openStudyHubGoogleAutomation?: ReturnType<typeof setInterval>;
  };
  if (state.__openStudyHubGoogleAutomation) return;

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
