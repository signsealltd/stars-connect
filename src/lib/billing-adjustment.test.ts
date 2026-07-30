import { describe, expect, it } from "vitest";
import { calculateBillingAdjustment } from "./billing-adjustment";

describe("manual billing totals", () => {
  it("keeps a simple outside-scope total", () => {
    expect(calculateBillingAdjustment(100, 0)).toEqual({
      netAmount: 100,
      vatRate: 0,
      vatAmount: 0,
      grossAmount: 100,
    });
  });

  it("recalculates VAT and rounds currency values", () => {
    expect(calculateBillingAdjustment("99.99", "20")).toEqual({
      netAmount: 99.99,
      vatRate: 20,
      vatAmount: 20,
      grossAmount: 119.99,
    });
  });

  it("accepts a reviewed zero total", () => {
    expect(calculateBillingAdjustment(0, 0).grossAmount).toBe(0);
  });

  it("rejects negative or invalid totals", () => {
    expect(() => calculateBillingAdjustment(-1, 0)).toThrow("INVALID_NET_AMOUNT");
    expect(() => calculateBillingAdjustment("not-a-number", 0)).toThrow("INVALID_NET_AMOUNT");
  });
});
