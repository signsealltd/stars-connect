import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { invoicePdf } from "./invoice-pdf";
import { safeDocumentName } from "./invoice-logo";

describe("invoice output regressions", () => {
  it("keeps all payment lines, omits blank VAT and places approval in the footer", () => {
    const pdf = invoicePdf({
      logoJpeg: readFileSync("public/branding/stars-logo-pdf.jpg"),
      invoiceNumber: "STARS-2026-00003",
      invoiceDate: "30 July 2026",
      dueDate: "29 August 2026",
      periodLabel: "30 July 2026",
      supplierName: "STARS Day Service",
      supplierAddress: ["Enfield"],
      companyNumber: "12345678",
      vatNumber: "",
      payerName: "Council",
      payerAddress: ["Enfield"],
      studentName: "Test Student",
      studentReference: "TEST1",
      rows: [{ date: "30 July 2026", days: "1.000", rate: "GBP 100.00", net: "GBP 100.00", vat: "GBP 0.00", total: "GBP 100.00" }],
      attendanceDays: "1.000",
      dayRate: "GBP 100.00",
      netTotal: "GBP 100.00",
      vatTotal: "GBP 0.00",
      grossTotal: "GBP 100.00",
      paymentTerms: "30 days",
      bankDetails: ["Bank line 1", "Bank line 2", "Bank line 3"],
      remittanceInstructions: ["Reference invoice and student"],
      approvedAt: "30 July 2026 21:12",
      generatedAt: "30 July 2026 21:20",
    }).toString("latin1");
    expect(pdf).toContain("(Bank line 1)");
    expect(pdf).toContain("(Bank line 2)");
    expect(pdf).toContain("(Bank line 3)");
    expect(pdf).not.toContain("(VAT number:");
    expect(pdf).not.toContain("(VAT)");
    expect(pdf).toContain("(Approved: 30 July 2026 21:12)");
    expect(pdf).toContain("(Generated: 30 July 2026 21:20)");
  });

  it("creates safe student-aware document names", () => {
    expect(safeDocumentName("Kellie O'Brien / Test")).toBe("Kellie-OBrien-Test");
  });
});
