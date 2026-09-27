import {
  getCurrentAcademicPeriod,
  listUserAgenda,
  type AgendaSlot,
  type CurrentAcademicPeriod,
} from "@/lib/academic";
import { formatMinutes, joinLocation } from "@/lib/academic-format";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getTranslations } from "@/lib/translations";
import { canonicalIdForLegacy } from "@/lib/v2/identity-bridge";
import { withV2Db } from "@/lib/v2/runtime";
import {
  getV2UserCurrentPeriod,
  listV2UserAgenda,
} from "@/lib/v2/academic-read";
import {
  defaultUiLanguage,
  getUiLanguage,
  type UiLanguage,
} from "@/lib/ui-language";

export const dynamic = "force-dynamic";

type ScheduleData =
  | {
      available: true;
      language: UiLanguage;
      slots: AgendaSlot[];
      currentPeriod: CurrentAcademicPeriod | null;
    }
  | { available: false; language: UiLanguage };

function loadScheduleData(userId: number): ScheduleData {
  let language = defaultUiLanguage;

  try {
    language = getUiLanguage();
    if (process.env.OPENSTUDYHUB_V2_ENABLED === "1")
      return withV2Db((db) => {
        const canonicalId = canonicalIdForLegacy(db, userId);
        return {
          available: true as const,
          language,
          slots: canonicalId ? listV2UserAgenda(db, canonicalId) : [],
          currentPeriod: canonicalId
            ? getV2UserCurrentPeriod(db, canonicalId)
            : null,
        };
      });
    return {
      available: true,
      language,
      slots: listUserAgenda(userId),
      currentPeriod: getCurrentAcademicPeriod(),
    };
  } catch {
    return { available: false, language };
  }
}

export default async function SchedulePage() {
  const user = await requireAuthenticatedUser();
  const data = loadScheduleData(user.id);
  const { academic } = getTranslations(data.language);
  const weekdays = [
    academic.monday,
    academic.tuesday,
    academic.wednesday,
    academic.thursday,
    academic.friday,
    academic.saturday,
    academic.sunday,
  ];

  return (
    <div className="academic-shell">
      <header className="academic-heading">
        <p className="system-label">{academic.scheduleSystem}</p>
        <h1>{academic.scheduleTitle}</h1>
        {data.available ? (
          <span className="count-label">
            {data.currentPeriod?.label ?? "—"} /{" "}
            {String(data.slots.length).padStart(2, "0")}
          </span>
        ) : null}
      </header>

      {!data.available ? (
        <div className="academic-empty" role="alert">
          <strong>{academic.databaseUnavailable}</strong>
        </div>
      ) : !data.currentPeriod ? (
        <div className="academic-empty">
          <strong>{academic.currentPeriodMissing}</strong>
          <span>{academic.currentPeriodMissingHint}</span>
        </div>
      ) : data.slots.length === 0 ? (
        <div className="academic-empty">
          <strong>{academic.noSchedule}</strong>
          <span>{academic.noScheduleHint}</span>
        </div>
      ) : (
        <div className="schedule-board">
          {weekdays.map((weekday, index) => {
            const slots = data.slots.filter(
              ({ weekday }) => weekday === index + 1,
            );
            if (slots.length === 0) return null;

            return (
              <section className="schedule-day" key={weekday}>
                <h2>{weekday}</h2>
                <ol>
                  {slots.map((slot) => {
                    const location = joinLocation([
                      slot.campus,
                      slot.building,
                      slot.room,
                      slot.locationName,
                    ]);

                    return (
                      <li key={slot.slotId}>
                        <time>
                          {formatMinutes(slot.startsAtMinutes)}—
                          {formatMinutes(slot.endsAtMinutes)}
                        </time>
                        <div>
                          <strong>{slot.subjectName}</strong>
                          <span>
                            {slot.programShortName ?? slot.programName} /{" "}
                            {slot.periodLabel}
                          </span>
                        </div>
                        <span>{location ?? academic.noLocation}</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
