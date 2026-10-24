import { requireControlAdmin } from "@/lib/v2/control-auth";
import { readAiConfig } from "@/lib/ai/config";
import { getUiLanguage } from "@/lib/ui-language";
import { ConsoleShell } from "../ui";
import { AiSettings } from "./ai-settings";
export default async function AiAdmin() {
  const actor = await requireControlAdmin(),
    state = readAiConfig(),
    english = getUiLanguage() === "en";
  return (
    <ConsoleShell
      admin
      name={actor.name}
      active="ai"
      title={english ? "AI assistant" : "Assistente de IA"}
      kicker="OpenStudyHub Admin"
    >
      <AiSettings
        initial={state.config}
        hasCredential={!!state.credentialEncrypted}
        tested={!!state.testedHash}
        english={english}
      />
    </ConsoleShell>
  );
}
