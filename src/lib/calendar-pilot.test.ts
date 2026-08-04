import { describe, expect, it } from "vitest";
import { calendarDateKeys, calendarPilotEnabled, canUseCalendarPilot, expectedOnDate } from "./calendar-pilot";

describe("restricted calendar pilot", () => {
  it("is limited to directors and administrators", () => {
    expect(canUseCalendarPilot("ADMINISTRATOR")).toBe(true);
    expect(canUseCalendarPilot("DIRECTOR")).toBe(true);
    expect(canUseCalendarPilot("MANAGER")).toBe(false);
    expect(canUseCalendarPilot("RECEPTION")).toBe(false);
  });
  it("supports an emergency environment kill switch", () => {
    expect(calendarPilotEnabled(undefined)).toBe(true);
    expect(calendarPilotEnabled("true")).toBe(true);
    expect(calendarPilotEnabled("false")).toBe(false);
  });
  it("maps expected weekdays without changing attendance", () => {
    expect(expectedOnDate([1, 3, 5], "2026-08-03")).toBe(true);
    expect(expectedOnDate([1, 3, 5], "2026-08-04")).toBe(false);
  });
  it("bounds pilot calendar reads", () => {
    expect(calendarDateKeys("2026-08-01", "2026-08-14")).toHaveLength(14);
    expect(() => calendarDateKeys("2026-08-01", "2026-10-01")).toThrow("INVALID_DATE_RANGE");
  });
});
