import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const APP_TIME_ZONE = "Europe/London";

export function localDateKey(date: Date = new Date()) {
  return formatInTimeZone(date, APP_TIME_ZONE, "yyyy-MM-dd");
}

export function formatUkDate(date: Date | string, pattern = "dd/MM/yyyy") {
  return formatInTimeZone(new Date(date), APP_TIME_ZONE, pattern);
}

export function formatUkTime(date: Date | string) {
  return formatInTimeZone(new Date(date), APP_TIME_ZONE, "HH:mm");
}

export function formatUkDateTime(date: Date | string) {
  return formatInTimeZone(new Date(date), APP_TIME_ZONE, "dd/MM/yyyy HH:mm");
}

export function localDayBounds(key = localDateKey()) {
  return {
    start: fromZonedTime(`${key}T00:00:00`, APP_TIME_ZONE),
    end: fromZonedTime(`${key}T23:59:59.999`, APP_TIME_ZONE),
  };
}

export function localDateAsDatabaseDate(key = localDateKey()) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function isExpectedDay(expectedDays: unknown, key = localDateKey()) {
  const noon = fromZonedTime(`${key}T12:00:00`, APP_TIME_ZONE);
  const day = Number(formatInTimeZone(noon, APP_TIME_ZONE, "i"));
  return Array.isArray(expectedDays) && expectedDays.map(Number).includes(day);
}
