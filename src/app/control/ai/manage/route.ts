import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import { recordAdminAction } from "@/lib/v2/audit";
import { getDatabase } from "@/lib/db/client";
import { isSameOriginRequest } from "@/lib/request-security";
import {
  aiConfigSchema,
  readAiConfig,
  saveAiConfig,
  aiCredential,
} from "@/lib/ai/config";
import {
  probeProvider,
  providerUrl,
  loadedModels,
  setModelLoaded,
} from "@/lib/ai/provider";
const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response(null, { status: 403 });
  return withV2DbAsync(async (db) => {
    const actor = await currentAdminV2(db);
    if (!actor || actor.mustChangePassword)
      return new Response(null, { status: 401 });
    try {
      if (Number(request.headers.get("content-length")) > 20000)
        throw new Error();
      const input = await request.json();
      if (["loaded", "load", "unload"].includes(input.action)) {
        // Memory controls act on the saved configuration, never on unsaved form values.
        const state = readAiConfig();
        const credential = aiCredential(state.credentialEncrypted);
        if (input.action !== "loaded") {
          if (typeof input.model !== "string") throw new Error();
          await setModelLoaded(
            state.config,
            credential,
            input.model,
            input.action === "load",
          );
          recordAdminAction(
            db,
            actor,
            `ai.model_${input.action}`,
            "instance",
            1,
          );
        }
        return Response.json(
          { loaded: await loadedModels(state.config, credential) },
          { headers },
        );
      }
      const candidate = aiConfigSchema.parse(input.config);
      providerUrl(candidate.endpoint, "/api/tags");
      if (
        input.credential !== undefined &&
        (typeof input.credential !== "string" ||
          input.credential.length > 2048 ||
          /[\r\n]/.test(input.credential))
      )
        throw new Error();
      if (input.action === "test") {
        const saved = saveAiConfig(
          { ...candidate, enabled: false },
          input.credential,
        );
        const result = await probeProvider(
          saved.config,
          aiCredential(saved.encrypted),
        );
        // Record which allowed models accept images; this does not change the provider key.
        const probed = saveAiConfig(
          { ...saved.config, visionModels: result.visionModels },
          undefined,
        );
        if (probed.config.models.length)
          getDatabase()
            .sqlite.prepare("UPDATE ai_config SET tested_hash=? WHERE id=1")
            .run(probed.key);
        recordAdminAction(db, actor, "ai.connection_test", "instance", 1);
        return Response.json(
          {
            models: result.models,
            config: probed.config,
            hasCredential: !!probed.encrypted,
            tested: !!probed.config.models.length,
          },
          { headers },
        );
      }
      if (input.action !== "save") throw new Error();
      saveAiConfig(candidate, input.credential);
      recordAdminAction(db, actor, "ai.configure", "instance", 1);
      const state = readAiConfig();
      return Response.json(
        {
          config: state.config,
          hasCredential: !!state.credentialEncrypted,
          tested: !!state.testedHash,
        },
        { headers },
      );
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error &&
            error.name !== "ZodError" &&
            error.message.includes(" / ")
              ? error.message
              : "Não foi possível salvar ou conectar. Confira endereço, modelo, credencial e teste a conexão antes de ativar. / Unable to save or connect. Check endpoint, model and credentials, and test before enabling.",
        },
        { status: 400, headers },
      );
    }
  });
}
