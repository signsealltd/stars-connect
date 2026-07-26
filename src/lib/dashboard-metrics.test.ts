import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { staffDashboardMetrics, studentDashboardMetrics } from "./dashboard-metrics";

describe("dashboard metrics", () => {
  it("uses active students consistently across attendance tiles", () => {
    const metrics = studentDashboardMetrics(
      [{ id: "active", expectedDays: [1] }, { id: "offsite", expectedDays: [1] }],
      [
        { studentId: "active", status: "PRESENT" },
        { studentId: "offsite", status: "OFFSITE" },
        { studentId: "archived", status: "PRESENT" },
      ],
      "2026-07-27",
    );
    expect(metrics).toEqual({
      present: 1,
      absent: 0,
      offsite: 1,
      late: 0,
      expected: 2,
      notMarked: 0,
    });
  });

  it("does not let seeded demonstration activity inflate operational totals", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/dashboard/route.ts"), "utf8");
    expect(route.match(/device:\{isSeedData:false,lastSyncAt:\{not:null\}\}/g)).toHaveLength(3);
  });
  it("counts only expected unmarked students as not marked", () => {
    const metrics = studentDashboardMetrics(
      [
        { id: "expected", expectedDays: [1] },
        { id: "not-expected", expectedDays: [2] },
      ],
      [{ studentId: "not-expected", status: "ABSENT" }],
      "2026-07-27",
    );
    expect(metrics.expected).toBe(1);
    expect(metrics.notMarked).toBe(1);
  });

  it("does not call a normal same-day clock-in a missing clock-out", () => {
    const start = new Date("2026-07-27T00:00:00Z");
    expect(
      staffDashboardMetrics(
        [
          { type: "CLOCK_IN", deviceTimestamp: new Date("2026-07-27T08:00:00Z") },
          { type: "CLOCK_IN", deviceTimestamp: new Date("2026-07-26T08:00:00Z") },
          { type: "CLOCK_OUT", deviceTimestamp: new Date("2026-07-27T09:00:00Z") },
        ],
        start,
      ),
    ).toEqual({ staffIn: 2, missingClockOut: 1 });
  });
});
