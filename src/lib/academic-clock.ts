/** Academic calendar math must not inherit the server's operating-system timezone. */
export const DEFAULT_ACADEMIC_TIME_ZONE = "America/Bahia";
export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + "T00:00:00Z");
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}
export function academicClock(
  now: Date,
  timeZone = DEFAULT_ACADEMIC_TIME_ZONE,
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const day = new Date(date + "T00:00:00Z").getUTCDay();
  return {
    date,
    weekday: day || 7,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}
export function addAcademicDays(date: string, days: number) {
  if (!validCalendarDate(date)) throw new Error("Data inválida.");
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function academicMidnight(
  date: string,
  timeZone = DEFAULT_ACADEMIC_TIME_ZONE,
) {
  const target = Date.parse(date + "T00:00:00Z");
  let epoch = target;
  for (let i = 0; i < 4; i++) {
    const local = academicClock(new Date(epoch), timeZone);
    epoch +=
      target - (Date.parse(local.date + "T00:00:00Z") + local.minutes * 60000);
  }
  return epoch;
}

export function academicLocalDateTime(
  value: string,
  timeZone = DEFAULT_ACADEMIC_TIME_ZONE,
) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (
    !match ||
    !validCalendarDate(match[1]) ||
    Number(match[2]) > 23 ||
    Number(match[3]) > 59
  )
    throw new Error("Data ou horário inválido.");
  const desiredMinutes = Number(match[2]) * 60 + Number(match[3]);
  let epoch = academicMidnight(match[1], timeZone) + desiredMinutes * 60000;
  for (let i = 0; i < 3; i++) {
    const local = academicClock(new Date(epoch), timeZone);
    epoch +=
      Date.parse(match[1] + "T00:00:00Z") -
      Date.parse(local.date + "T00:00:00Z") +
      (desiredMinutes - local.minutes) * 60000;
  }
  const local = academicClock(new Date(epoch), timeZone);
  if (local.date !== match[1] || local.minutes !== desiredMinutes)
    throw new Error("Este horário não existe no fuso escolhido.");
  return new Date(epoch);
}
export function academicDateTimeInput(
  date: Date,
  timeZone = DEFAULT_ACADEMIC_TIME_ZONE,
) {
  const clock = academicClock(date, timeZone);
  return `${clock.date}T${String(Math.floor(clock.minutes / 60)).padStart(2, "0")}:${String(clock.minutes % 60).padStart(2, "0")}`;
}
