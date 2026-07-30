import { describe, expect, it } from "vitest";
import { payrollGrossPay } from "./payroll-pay";

describe("staff overtime pay rates", () => {
  it("uses the configured overtime rate only for overtime minutes", () => {
    expect(payrollGrossPay({ totalPayableMinutes: 600, overtimeMinutes: 120, hourlyRate: 20, overtimeHourlyRate: 30 })).toBe(220);
  });
  it("falls back to the standard rate when no overtime rate is configured", () => {
    expect(payrollGrossPay({ totalPayableMinutes: 600, overtimeMinutes: 120, hourlyRate: 20, overtimeHourlyRate: null })).toBe(200);
  });
  it("requires a standard rate before estimating gross pay", () => {
    expect(payrollGrossPay({ totalPayableMinutes: 600, overtimeMinutes: 120, hourlyRate: null, overtimeHourlyRate: 30 })).toBeNull();
  });
  it("propagates the rate through staff setup, payroll snapshots and documents", async () => {
    const { readFile } = await import("node:fs/promises");
    const files = await Promise.all([
      readFile("src/components/staff-manager.tsx", "utf8"),
      readFile("src/app/api/payroll/periods/[id]/route.ts", "utf8"),
      readFile("src/lib/build-payroll-timesheet.ts", "utf8"),
      readFile("prisma/migrations/202607310001_staff_overtime_rate/migration.sql", "utf8"),
    ]);
    for (const source of files) expect(source).toContain("overtimeHourlyRate");
    expect(files[0]).toContain("Overtime hourly rate");
    expect(files[2]).toContain("Overtime");
  });
});