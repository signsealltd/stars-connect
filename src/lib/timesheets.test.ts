import { describe, expect, it } from "vitest";
import { openClockIn } from "./timesheets";

const event = (id: string, type: "CLOCK_IN" | "CLOCK_OUT", at: string) => ({
  id, type, deviceTimestamp: new Date(at), deviceId: "device-1", corrections: [],
});

describe("timesheet clock state", () => {
  it("returns the unmatched clock-in", () => {
    expect(openClockIn([event("1", "CLOCK_IN", "2026-07-29T08:00:00Z")])?.id).toBe("1");
  });
  it("returns no open event after clock-out", () => {
    expect(openClockIn([
      event("1", "CLOCK_IN", "2026-07-29T08:00:00Z"),
      event("2", "CLOCK_OUT", "2026-07-29T16:00:00Z"),
    ])).toBeUndefined();
  });
  it("uses the latest correction when determining state", () => {
    const corrected = {
      ...event("1", "CLOCK_IN", "2026-07-29T08:00:00Z"),
      corrections: [{ newValue: { type: "CLOCK_OUT", deviceTimestamp: "2026-07-29T16:00:00.000Z" } }],
    };
    expect(openClockIn([corrected])).toBeUndefined();
  });
});
