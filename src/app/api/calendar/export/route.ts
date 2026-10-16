import { getCurrentSession } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { getServerEnvironment } from "@/lib/env";
import { examForLegacyUser } from "@/lib/v2/exam-access";
import {
  collectCalendarEntries,
  serializeCalendar,
  type CalendarKind,
} from "@/lib/calendar-export";
import { uiText } from "@/lib/translations";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const session = await getCurrentSession();
  const headers = {
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  };
  if (!session)
    return Response.json(
      { error: "Authentication required." },
      { status: 401, headers },
    );
  const profile = getUserProfile(session.user.id),
    tr = (pt: string, en: string) => uiText(profile.locale, pt, en);
  if (profile.onboardingVersion < 1 || examForLegacyUser(session.user.id))
    return Response.json(
      {
        error: tr(
          "Exportação indisponível neste momento.",
          "Export is unavailable right now.",
        ),
      },
      { status: 403, headers },
    );
  try {
    const q = new URL(request.url).searchParams;
    const { entries } = collectCalendarEntries(
      session.user.id,
      q.get("from") ?? "",
      q.get("until") ?? "",
      (q.get("include") ?? "").split(",") as CalendarKind[],
    );
    return new Response(
      serializeCalendar(
        entries,
        session.user.id,
        getServerEnvironment().APP_URL,
      ),
      {
        headers: {
          ...headers,
          "content-type": "text/calendar; charset=utf-8",
          "content-disposition":
            'attachment; filename="openstudyhub-agenda.ics"',
          "x-calendar-count": String(entries.length),
        },
      },
    );
  } catch {
    return Response.json(
      {
        error: tr(
          "Não foi possível exportar. Escolha pelo menos um conteúdo e um período de até um ano; reduza o período se houver muitos compromissos.",
          "Could not export. Select at least one category and a date range of up to one year; shorten it if there are too many entries.",
        ),
      },
      { status: 400, headers },
    );
  }
}
