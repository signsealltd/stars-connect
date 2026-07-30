import { describe, expect, it } from "vitest";
import { calculatePayroll } from "./payroll";
import {
  defaultPayrollReason,
  payrollAdjustmentForReason,
  payrollAdjustmentOptions,
} from "./payroll-adjustment-options";

describe("payroll adjustment categories", () => {
  it("maps every reason to its authoritative category and paid status", () => {
    expect(payrollAdjustmentForReason("APPROVED_ANNUAL_LEAVE")).toMatchObject({ category: "HOLIDAY", paid: true });
    expect(payrollAdjustmentForReason("REPORTED_SICKNESS")).toMatchObject({ category: "SICKNESS", paid: true });
    expect(payrollAdjustmentForReason("AUTHORISED_OVERTIME")).toMatchObject({ category: "OVERTIME", paid: true });
    expect(payrollAdjustmentForReason("MANDATORY_TRAINING")).toMatchObject({ category: "TRAINING", paid: true });
    expect(payrollAdjustmentForReason("UNPAID_LEAVE")).toMatchObject({ category: "UNPAID", paid: false });
    expect(defaultPayrollReason("OTHER").category).toBe("OTHER");
    expect(payrollAdjustmentOptions).toHaveLength(7);
  });

  it("separates eight-hour pay items without duplicating category totals", () => {
    const adjustments = payrollAdjustmentOptions.map((option) => ({
      category: "HOLIDAY", // simulates records created by the old uncoupled dropdowns
      minutes: 480,
      paid: option.paid,
      reason: option.label,
    }));
    const result = calculatePayroll([], adjustments, {
      ordinaryDailyMinutes: 480,
      longShiftMinutes: 720,
      shortShiftMinutes: 120,
      transportClockInMinutes: 0,
      transportClockOutMinutes: 0,
      roundingIntervalMinutes: 15,
    });

    expect(result.ordinaryMinutes).toBe(0);
    expect(result.overtimeMinutes).toBe(480);
    expect(result.holidayMinutes).toBe(480);
    expect(result.sicknessMinutes).toBe(480);
    expect(result.trainingMinutes).toBe(480);
    expect(result.unpaidMinutes).toBe(480);
    expect(result.adjustmentMinutes).toBe(960);
    expect(result.totalPayableMinutes).toBe(2880);
  });

  it("keeps category totals exact when worked minutes are rounded", () => {
    const result = calculatePayroll(
      [
        { id: "in", type: "CLOCK_IN", deviceTimestamp: new Date("2026-07-30T08:00:00Z") },
        { id: "out", type: "CLOCK_OUT", deviceTimestamp: new Date("2026-07-30T08:01:00Z") },
      ],
      [{ category: "HOLIDAY", minutes: 480, paid: true, reason: "Approved annual leave" }],
      {
        ordinaryDailyMinutes: 480,
        longShiftMinutes: 720,
        shortShiftMinutes: 120,
        transportClockInMinutes: 0,
        transportClockOutMinutes: 0,
        roundingIntervalMinutes: 15,
      },
    );

    expect(result.holidayMinutes).toBe(480);
    expect(result.adjustmentMinutes).toBe(-1);
    expect(result.totalPayableMinutes).toBe(480);
  });
});
