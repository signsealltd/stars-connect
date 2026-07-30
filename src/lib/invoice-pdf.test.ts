import { describe, expect, it } from "vitest";
import { invoicePdf } from "./invoice-pdf";

const tinyJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEABj8Cf//Z",
  "base64",
);

const fixture = (rows = 1) => ({
  logoJpeg: tinyJpeg,
  invoiceNumber: "STARS-2026-00001",
  invoiceDate: "30 July 2026",
  dueDate: "29 August 2026",
  periodLabel: "01 Jul 2026 - 31 Jul 2026",
  supplierName: "STARS Day Service",
  supplierAddress: ["Enfield, London"],
  companyNumber: "12345678",
  vatNumber: "",
  payerName: "Enfield Council",
  payerAddress: ["Civic Centre", "Enfield"],
  studentName: "Test Student",
  studentReference: "TEST1",
  rows: Array.from({ length: rows }, (_, index) => ({
    date: `${String(index + 1).padStart(2, "0")}/07/2026`,
    days: "1.000",
    rate: "GBP 100.00",
    net: "GBP 100.00",
    vat: "GBP 0.00",
    total: "GBP 100.00",
  })),
  attendanceDays: `${rows}.000`,
  dayRate: "GBP 100.00",
  netTotal: `GBP ${rows * 100}.00`,
  vatTotal: "GBP 0.00",
  grossTotal: `GBP ${rows * 100}.00`,
  paymentTerms: "Payment is due by the date shown.",
  bankDetails: ["Account details supplied separately"],
  remittanceInstructions: ["Quote the invoice number with payment."],
  approvedAt: "30 July 2026 21:12",
  generatedAt: "30 July 2026 21:20",
});

describe("official invoice PDF", () => {
  it("shows formal invoice, student reference, period, dates and totals without internal adjustment wording", () => {
    const text = invoicePdf(fixture()).toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("(OFFICIAL INVOICE)");
    expect(text).toContain("(STARS-2026-00001)");
    expect(text).toContain("(Test Student)");
    expect(text).toContain("(TEST1)");
    expect(text).toContain("(ATTENDANCE BREAKDOWN)");
    expect(text).toContain("(01/07/2026)");
    expect(text).not.toContain("Manager confirmed");
    expect(text).toContain("/Subtype /Image");
  });

  it("paginates a full attendance month and repeats invoice context", () => {
    const text = invoicePdf(fixture(31)).toString("latin1");
    expect(text).toContain("/Count 3");
    expect(text).toContain("(Test Student - attendance continued)");
    expect(text).toContain("(Page 3 of 3)");
  });
});
