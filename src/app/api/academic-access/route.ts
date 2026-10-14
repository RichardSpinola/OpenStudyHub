import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/authorization";
import { examForLegacyUser } from "@/lib/v2/exam-access";
export async function GET() {
  const session = await getCurrentSession();
  if (!session)
    return NextResponse.json({ restricted: false }, { status: 401 });
  const exam = examForLegacyUser(session.user.id);
  return NextResponse.json(
    { restricted: !!exam, endsAt: exam?.endsAt ?? null },
    { headers: { "cache-control": "private, no-store" } },
  );
}
