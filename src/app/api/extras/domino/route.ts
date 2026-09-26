import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import { extraAccessible, getExtrasFlags } from "@/lib/v2/extras";
import {
  actDominoMatch,
  createDominoMatch,
  dominoMatchView,
  joinDominoMatch,
  listDominoMatches,
} from "@/lib/v2/domino-match";

export const dynamic = "force-dynamic";
const bodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create") }),
  z.object({
    type: z.literal("join"),
    code: z.string().regex(/^[a-f0-9]{32}$/),
  }),
  z.object({
    type: z.literal("action"),
    id: z.string().uuid(),
    version: z.number().int().positive(),
    action: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("play"),
        tile: z.number().int().min(0).max(27),
        side: z.enum(["left", "right"]),
      }),
      z.object({ type: z.literal("draw") }),
      z.object({ type: z.literal("pass") }),
      z.object({ type: z.literal("resign") }),
    ]),
  }),
]);
const unavailable = () =>
  NextResponse.json({ error: "Partida indisponível." }, { status: 404 });
export async function GET(request: NextRequest) {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1") return unavailable();
  return withV2DbAsync(async (db) => {
    const user = await currentUserV2(db);
    if (!user || user.kind !== "user" || user.mustChangePassword)
      return NextResponse.json(
        { error: "Sessão necessária." },
        { status: 401 },
      );
    if (!extraAccessible(getExtrasFlags(db), "domino")) return unavailable();
    const id = request.nextUrl.searchParams.get("id");
    try {
      return NextResponse.json(
        id
          ? dominoMatchView(db, z.string().uuid().parse(id), user.id)
          : listDominoMatches(db, user.id),
        { headers: { "cache-control": "private, no-store" } },
      );
    } catch {
      return unavailable();
    }
  });
}
export async function POST(request: NextRequest) {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1") return unavailable();
  if (
    request.headers.get("origin") !==
    new URL(process.env.APP_URL ?? request.url).origin
  )
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  return withV2DbAsync(async (db) => {
    const user = await currentUserV2(db);
    if (!user || user.kind !== "user" || user.mustChangePassword)
      return NextResponse.json(
        { error: "Sessão necessária." },
        { status: 401 },
      );
    if (!extraAccessible(getExtrasFlags(db), "domino")) return unavailable();
    try {
      const body = bodySchema.parse(await request.json());
      if (body.type === "create")
        return NextResponse.json(createDominoMatch(db, user.id));
      if (body.type === "join")
        return NextResponse.json({
          id: joinDominoMatch(db, body.code, user.id),
        });
      return NextResponse.json(
        actDominoMatch(db, body.id, user.id, body.version, body.action),
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error && !(error instanceof z.ZodError)
              ? error.message
              : "Dados inválidos.",
        },
        { status: 400 },
      );
    }
  });
}
