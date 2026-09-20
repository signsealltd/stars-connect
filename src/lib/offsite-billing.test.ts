import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { isBillableAttendanceStatus } from "./billing";

describe("offsite student billing", () => {
  it("treats offsite as attended for billing while absent remains non-billable", () => {
    expect(isBillableAttendanceStatus("OFFSITE")).toBe(true);
    expect(isBillableAttendanceStatus("PRESENT")).toBe(true);
    expect(isBillableAttendanceStatus("ABSENT")).toBe(false);
  });

  it("routes new calculations through funding agreements independently of register status", () => {
    const route = readFileSync("src/app/api/billing/runs/[id]/route.ts", "utf8");
    expect(route).toContain('calculateFundedRun(id)');
    expect(route).not.toContain('studentAttendance');
  });
});
