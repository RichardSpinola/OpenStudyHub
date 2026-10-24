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
import { probeProvider, providerUrl } from "@/lib/ai/provider";
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
        if (saved.config.model)
          getDatabase()
            .sqlite.prepare("UPDATE ai_config SET tested_hash=? WHERE id=1")
            .run(saved.key);
        recordAdminAction(db, actor, "ai.connection_test", "instance", 1);
        return Response.json(
          {
            ...result,
            config: saved.config,
            hasCredential: !!saved.encrypted,
            tested: !!saved.config.model,
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
    } catch {
      return Response.json(
        {
          error:
            "Não foi possível salvar ou conectar. Confira endereço, modelo, credencial e teste a conexão antes de ativar. / Unable to save or connect. Check endpoint, model and credentials, and test before enabling.",
        },
        { status: 400, headers },
      );
    }
  });
}
