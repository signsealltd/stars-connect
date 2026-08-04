import type { Role } from "@prisma/client";

export const CALENDAR_PILOT_MAX_DAYS = 31;
export const CALENDAR_PILOT_ROLES: Role[] = ["DIRECTOR", "ADMINISTRATOR"];

export function calendarPilotEnabled(value = process.env.CALENDAR_PILOT_ENABLED) {
  return value !== "false";
}

export function canUseCalendarPilot(role: Role) {
  return CALENDAR_PILOT_ROLES.includes(role);
}

export function expectedOnDate(expectedDays: unknown, dateKey: string) {
  const day = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay() || 7;
  return Array.isArray(expectedDays) && expectedDays.map(Number).includes(day);
}

export function calendarDateKeys(startKey: string, endKey: string) {
  const start = new Date(`${startKey}T00:00:00.000Z`);
  const end = new Date(`${endKey}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) throw new Error("INVALID_DATE_RANGE");
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > CALENDAR_PILOT_MAX_DAYS) throw new Error("INVALID_DATE_RANGE");
  return Array.from({ length: days }, (_, index) => new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10));
}
