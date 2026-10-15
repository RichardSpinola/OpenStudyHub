import type { AgendaSlot } from "./academic";
export function weeklyLayout(slots: AgendaSlot[]) {
  const valid = slots.filter(
    (s) =>
      s.weekday >= 1 &&
      s.weekday <= 7 &&
      s.startsAtMinutes >= 0 &&
      s.endsAtMinutes <= 1440 &&
      s.endsAtMinutes > s.startsAtMinutes,
  );
  const start = valid.length
    ? Math.floor(Math.min(...valid.map((s) => s.startsAtMinutes)) / 30) * 30
    : 480;
  const end = valid.length
    ? Math.max(
        start + 60,
        Math.ceil(Math.max(...valid.map((s) => s.endsAtMinutes)) / 30) * 30,
      )
    : 540;
  const events: Array<{
    slot: AgendaSlot;
    row: number;
    span: number;
    lane: number;
    lanes: number;
  }> = [];
  for (let day = 1; day <= 7; day++) {
    const sorted = valid
      .filter((s) => s.weekday === day)
      .sort(
        (a, b) => a.startsAtMinutes - b.startsAtMinutes || a.slotId - b.slotId,
      );
    let cluster: typeof events = [],
      ends: number[] = [],
      clusterEnd = -1;
    const flush = () => {
      for (const event of cluster) event.lanes = ends.length;
      cluster = [];
      ends = [];
    };
    for (const slot of sorted) {
      if (slot.startsAtMinutes >= clusterEnd) {
        flush();
        clusterEnd = -1;
      }
      let lane = ends.findIndex((end) => end <= slot.startsAtMinutes);
      if (lane < 0) lane = ends.length;
      ends[lane] = slot.endsAtMinutes;
      clusterEnd = Math.max(clusterEnd, slot.endsAtMinutes);
      const event = {
        slot,
        row: Math.floor((slot.startsAtMinutes - start) / 5) + 2,
        span: Math.max(
          1,
          Math.ceil((slot.endsAtMinutes - slot.startsAtMinutes) / 5),
        ),
        lane,
        lanes: 1,
      };
      cluster.push(event);
      events.push(event);
    }
    flush();
  }
  return { start, end, rows: (end - start) / 5, events };
}

/** Compact portal view: actual intervals, without artificial rows or proportional cards. */
export function weeklyScheduleRows(slots: AgendaSlot[]) {
  const grouped = new Map<
    string,
    { start: number; end: number; slots: AgendaSlot[] }
  >();
  for (const slot of slots) {
    if (
      !Number.isInteger(slot.weekday) ||
      slot.weekday < 1 ||
      slot.weekday > 7 ||
      !Number.isInteger(slot.startsAtMinutes) ||
      !Number.isInteger(slot.endsAtMinutes) ||
      slot.startsAtMinutes < 0 ||
      slot.endsAtMinutes > 1440 ||
      slot.endsAtMinutes <= slot.startsAtMinutes
    )
      continue;
    const key = `${slot.startsAtMinutes}-${slot.endsAtMinutes}`;
    const row = grouped.get(key) ?? {
      start: slot.startsAtMinutes,
      end: slot.endsAtMinutes,
      slots: [],
    };
    row.slots.push(slot);
    grouped.set(key, row);
  }
  return [...grouped.values()].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
}
