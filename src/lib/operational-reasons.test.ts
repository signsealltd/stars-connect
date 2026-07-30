import { describe, expect, it } from "vitest";
import {
  billingProfileReasons,
  clockCorrectionReasons,
  financeCorrectionReasons,
  resolvedReason,
} from "./operational-reasons";

describe("operational reasons", () => {
  it("provides controlled options and Other", () => {
  for (const options of [clockCorrectionReasons, financeCorrectionReasons, billingProfileReasons]) {
    expect(options.length).toBeGreaterThanOrEqual(4);
    expect(options.at(-1)?.value).toBe("OTHER");
    expect(options.every(option => option.label.length >= 5)).toBe(true);
  }
});

  it("stores the selected label and uses custom text only for Other", () => {
  expect(
    resolvedReason(clockCorrectionReasons, "DEVICE_UNAVAILABLE", "ignored")).toBe("Kiosk or device was unavailable");
  expect(
    resolvedReason(financeCorrectionReasons, "OTHER", "  Authorised exceptional correction  ")).toBe("Authorised exceptional correction");
  });
});
