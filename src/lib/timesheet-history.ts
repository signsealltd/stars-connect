import { z } from "zod";
import { localDateKey, localDayBounds } from "./dates";
import { calculateWorkedMinutes } from "./domain";
import { effectiveClockEvent, type EffectiveClockEvent } from "./timesheets";

export function timesheetRange(from: unknown, to: unknown, today = localDateKey()) {
  const schema = z.string().date();
  const start = from === undefined ? today : from;
  const end = to === undefined ? start : to;
  if (!schema.safeParse(start).success || !schema.safeParse(end).success) throw new Error("Choose valid start and end dates.");
  const first = start as string, last = end as string;
  if (first > last) throw new Error("The end date must be on or after the start date.");
  if (last > today) throw new Error("Choose today or an earlier date.");
  if ((Date.parse(last) - Date.parse(first)) / 86400000 > 365) throw new Error("Choose a range of up to one year.");
  return { from: first, to: last, start: localDayBounds(first).start, end: localDayBounds(last).end, isToday: first === today && last === today };
}

export function timesheetHistory<T extends EffectiveClockEvent>(events: T[], start: Date, end: Date) {
  const effective = events.map(effectiveClockEvent).filter(event => event.deviceTimestamp >= start && event.deviceTimestamp <= end)
    .sort((a, b) => a.deviceTimestamp.getTime() - b.deviceTimestamp.getTime() || a.id.localeCompare(b.id));
  const groups = new Map<string, typeof effective>();
  effective.forEach(event => { const key = localDateKey(event.deviceTimestamp); groups.set(key, [...(groups.get(key) || []), event]); });
  const days = [...groups].map(([date, entries]) => ({ date, ...calculateWorkedMinutes(entries), events: entries.map(event => ({ id: event.id, type: event.type, at: event.deviceTimestamp.toISOString(), corrected: Boolean(event.corrections?.length) })) }));
  return { days, minutes: days.reduce((sum, day) => sum + day.minutes, 0), missingClockOut: days.some(day => day.missingClockOut) };
}
