import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { isBillableAttendanceStatus } from "./billing";

describe("offsite student billing", () => {
  it("treats offsite as attended for billing while absent remains non-billable", () => {
    expect(isBillableAttendanceStatus("OFFSITE")).toBe(true);
    expect(isBillableAttendanceStatus("PRESENT")).toBe(true);
    expect(isBillableAttendanceStatus("ABSENT")).toBe(false);
  });

  it("uses the shared billable-status rule when selecting attended charge rules", () => {
    const route = readFileSync("src/app/api/billing/runs/[id]/route.ts", "utf8");
    expect(route).toContain('isBillableAttendanceStatus(a.status)||r.attendanceDependency!=="ATTENDED"');
    expect(route).not.toContain('a.status==="PRESENT"||a.status==="LATE"||r.attendanceDependency!=="ATTENDED"');
  });
});
