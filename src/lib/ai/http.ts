import { getCurrentSession } from "@/lib/authorization";
import { assertToolAvailable } from "@/lib/v2/exam-access";
import { isSameOriginRequest } from "@/lib/request-security";
export const aiHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function aiUser(request: Request, mutate = false) {
  if (mutate && !isSameOriginRequest(request))
    throw new Error("Origem inválida / Invalid origin");
  const session = await getCurrentSession();
  if (!session) throw new Error("Entre novamente / Sign in again");
  assertToolAvailable(session.user.id);
  return session.user;
}
export function aiError(error: unknown) {
  // Only expose controlled application messages, never network/parser internals.
  const message =
    error instanceof Error && error.message.includes(" / ")
      ? error.message
      : "Não foi possível concluir. Confira suas permissões, arquivos e conexão. / Unable to complete. Check permissions, files and connection.";
  return Response.json({ error: message }, { status: 400, headers: aiHeaders });
}
