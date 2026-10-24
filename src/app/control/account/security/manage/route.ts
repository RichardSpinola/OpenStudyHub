import { cookies } from "next/headers";
import QRCode from "qrcode";
import { currentAdminV2, withV2DbAsync, ADMIN_COOKIE } from "@/lib/v2/runtime";
import { startMfaEnrollment, manageMfa } from "@/lib/security/admin-mfa";
import { isSameOriginRequest } from "@/lib/request-security";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!isSameOriginRequest(request))
    return Response.json(
      { error: "Origem inválida / Invalid origin" },
      { status: 403, headers },
    );
  return withV2DbAsync(async (db) => {
    const actor = await currentAdminV2(db);
    if (!actor || actor.mustChangePassword)
      return Response.json(
        { error: "Entre novamente / Sign in again" },
        { status: 401, headers },
      );
    try {
      if (Number(request.headers.get("content-length")) > 8192)
        throw new Error("Invalid input");
      const input = await request.json();
      if (typeof input.password !== "string" || input.password.length > 1024)
        throw new Error("Invalid input");
      if (input.action === "start") {
        const setup = await startMfaEnrollment(db, actor.id, input.password);
        return Response.json(
          {
            secret: setup.secret,
            qr: await QRCode.toDataURL(setup.uri, { margin: 2, width: 240 }),
          },
          { headers },
        );
      }
      if (
        !["enable", "disable", "regenerate"].includes(input.action) ||
        typeof input.code !== "string" ||
        input.code.length > 100
      )
        throw new Error("Invalid input");
      return Response.json(
        await manageMfa(
          db,
          actor.id,
          input.password,
          input.code,
          input.action,
          (await cookies()).get(ADMIN_COOKIE)?.value ?? "",
        ),
        { headers },
      );
    } catch {
      return Response.json(
        {
          error:
            "Confira a senha e o código. Aguarde 15 minutos se atingir o limite de tentativas. / Check your password and code. Wait 15 minutes if the attempt limit is reached.",
        },
        { status: 400, headers },
      );
    }
  });
}
