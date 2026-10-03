import { describe, expect, it } from "vitest";
import { timesheetHistory, timesheetRange } from "./timesheet-history";
const event = (id: string, type: "CLOCK_IN" | "CLOCK_OUT", timestamp: string, corrections: Array<{newValue: unknown}> = []) => ({ id, type, deviceId: "test", deviceTimestamp: new Date(timestamp), corrections });
describe("timesheet history", () => {
  it("uses London day boundaries across daylight saving time", () => {
    const range = timesheetRange("2026-10-25", "2026-10-25", "2026-10-26");
    expect(range.start.toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-25T23:59:59.999Z");
  });
  it("rejects invalid, future, reversed and excessive ranges", () => {
    for (const [from,to] of [["2026-02-30","2026-03-01"],["2026-10-04","2026-10-04"],["2026-10-03","2026-10-01"],["2020-01-01","2026-01-01"]]) expect(() => timesheetRange(from,to,"2026-10-03")).toThrow();
  });
  it("applies corrections, includes multiple shifts and does not join missing clock-outs to another day", () => {
    const range = timesheetRange("2026-09-01","2026-09-03","2026-10-03");
    const result = timesheetHistory([
      event("1","CLOCK_IN","2026-09-01T08:00:00Z"),
      event("2","CLOCK_OUT","2026-09-01T10:00:00Z",[{newValue:{deviceTimestamp:"2026-09-01T11:00:00Z"}}]),
      event("3","CLOCK_IN","2026-09-01T12:00:00Z"), event("4","CLOCK_OUT","2026-09-01T14:00:00Z"),
      event("5","CLOCK_IN","2026-09-02T08:00:00Z"), event("6","CLOCK_OUT","2026-09-03T12:00:00Z"),
      event("7","CLOCK_IN","2026-08-01T08:00:00Z")
    ],range.start,range.end);
    expect(result.minutes).toBe(300);
    expect(result.days).toHaveLength(3);
    expect(result.missingClockOut).toBe(true);
    expect(result.days[0].events[1].corrected).toBe(true);
  });
  it("filters by the corrected event date and handles an empty period", () => {
    const range=timesheetRange("2026-09-01","2026-09-01","2026-10-03");
    expect(timesheetHistory([event("1","CLOCK_IN","2026-09-01T08:00:00Z",[{newValue:{deviceTimestamp:"2026-09-02T08:00:00Z"}}])],range.start,range.end).days).toHaveLength(0);
  });
});
