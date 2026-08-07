import { describe, expect, it } from "vitest";
import { staffOccupancy } from "./staff-presence";

const at = (hour: number) => new Date("2026-08-07T" + String(hour).padStart(2, "0") + ":00:00Z");

describe("staff occupancy", () => {
  it("keeps offsite separate from clocking", () => {
    expect(staffOccupancy({ type: "CLOCK_IN", deviceTimestamp: at(8) }, { type: "WENT_OFFSITE", deviceTimestamp: at(10) })).toBe("OFFSITE");
    expect(staffOccupancy({ type: "CLOCK_IN", deviceTimestamp: at(8) }, { type: "RETURNED_ONSITE", deviceTimestamp: at(12) })).toBe("ONSITE");
  });

  it("does not let an earlier movement override a new shift", () => {
    expect(staffOccupancy({ type: "CLOCK_IN", deviceTimestamp: at(9) }, { type: "WENT_OFFSITE", deviceTimestamp: at(8) })).toBe("ONSITE");
  });

  it("always treats a clocked-out member as out", () => {
    expect(staffOccupancy({ type: "CLOCK_OUT", deviceTimestamp: at(17) }, { type: "WENT_OFFSITE", deviceTimestamp: at(16) })).toBe("OUT");
  });
});
