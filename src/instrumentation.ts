export async function register() {
  // Keep native database modules out of the Edge instrumentation bundle.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
      const { registerNodeAutomation } = await import("./instrumentation-node");
      registerNodeAutomation();
    }
  }
}
