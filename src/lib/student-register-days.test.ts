import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isExpectedDay } from "./dates";

describe("student register expected-day filtering", () => {
  it("matches only the configured weekday", () => {
    expect(isExpectedDay([1, 3, 5], "2026-08-03")).toBe(true);
    expect(isExpectedDay([2, 4], "2026-08-03")).toBe(false);
  });

  it("keeps an already-recorded student visible for correction", () => {
    const source = readFileSync("src/app/register/page.tsx", "utf8");
    expect(source).toContain("isExpectedDay(student.expectedDays, date) || Boolean(records[student.id])");
    expect(source).toContain("Attendance already recorded");
  });
});
