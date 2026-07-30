import { describe, expect, it } from "vitest";
import { calculateInvoiceServiceLine } from "./invoice-service-line";

describe("additional invoice service lines", () => {
  it("recalculates net, VAT and gross from quantity and unit price", () => {
    expect(calculateInvoiceServiceLine(2, 37.5, 20)).toEqual({
      netAmount: 75,
      vatAmount: 15,
      grossAmount: 90,
    });
  });

  it("supports VAT-free services and rejects invalid values", () => {
    expect(calculateInvoiceServiceLine(1, 48, 0)).toEqual({
      netAmount: 48,
      vatAmount: 0,
      grossAmount: 48,
    });
    expect(() => calculateInvoiceServiceLine(0, 48, 0)).toThrow("INVALID_QUANTITY");
    expect(() => calculateInvoiceServiceLine(1, -1, 0)).toThrow("INVALID_UNIT_RATE");
  });
});
