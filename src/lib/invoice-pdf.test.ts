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
  studentName: "Test Client",
  studentReference: "TEST1",
  rows: Array.from({ length: rows }, (_, index) => ({
    date: `${String(index + 1).padStart(2, "0")}/07/2026`,
    service: index === 0 ? "Day trip" : "Attendance",
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
  it("shows formal invoice, client reference, period, dates and totals without internal adjustment wording", () => {
    const text = invoicePdf(fixture()).toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("(OFFICIAL INVOICE)");
    expect(text).toContain("(STARS-2026-00001)");
    expect(text).toContain("(Test Client)");
    expect(text).toContain("(TEST1)");
    expect(text).toContain("(SERVICES)");
    expect(text).toContain("(01/07/2026)");
    expect(text).toContain("(Day trip)");
    expect(text).not.toContain("Manager confirmed");
    expect(text).toContain("/Subtype /Image");
  });

  it("normalises unsupported punctuation instead of printing replacement symbols", () => {
    const input = fixture();
    input.paymentTerms = "Payment is due – quote £100 “reference”.";
    const text = invoicePdf(input).toString("latin1");
    expect(text).toContain('(Payment is due - quote GBP 100 "reference".)');
    expect(text).not.toContain("(Payment is due ?");
  });

  it("prints a corrected historical billing period in the attendance column without truncation", () => {
    const input = fixture();
    input.rows[0].date = "29 June 2026 - 26 July 2026";
    const text = invoicePdf(input).toString("latin1");
    expect(text).toContain("(29 June 2026 - 26 July 2026)");
  });

  it("paginates a full attendance month and repeats invoice context", () => {
    const text = invoicePdf(fixture(31)).toString("latin1");
    expect(text).toContain("/Count 3");
    expect(text).toContain("(Test Client - services continued)");
    expect(text).toContain("(Page 3 of 3)");
  });

  it("keeps a typical seven-day invoice and payment details on one page", () => {
    const text = invoicePdf(fixture(7)).toString("latin1");
    expect(text).toContain("/Count 1");
    expect(text).toContain("(07/07/2026)");
    expect(text).toContain("(PAYMENT AND DOCUMENT DETAILS)");
    expect(text).toContain("(Page 1 of 1)");
  });

  it("still paginates longer attendance breakdowns", () => {
    const text = invoicePdf(fixture(10)).toString("latin1");
    expect(text).toContain("/Count 2");
    expect(text).toContain("(10/07/2026)");
    expect(text).toContain("(PAYMENT AND DOCUMENT DETAILS)");
    expect(text).toContain("(Page 2 of 2)");
  });
});

it("uses simple client columns and repeats a supplied PO below the invoice number",()=>{const pdf=invoicePdf({...fixture(),purchaseOrderNumber:"PO-123"}).toString("latin1");for(const label of ["CLIENT","QTY","RATE","NET","TOTAL","Your Ref: PO-123","PO: PO-123"])expect(pdf).toContain(`(${label})`);expect(pdf).not.toContain("FUNDED");expect(pdf).not.toContain("SERVICE USER")});

it("preserves long custom descriptions and service dates across continuation rows",()=>{const input=fixture();input.rows[0].service="Additional respite weekend with staff support and transport included";input.rows[0].date="Monday 7 September to Wednesday 9 September 2026";const pdf=invoicePdf(input).toString("latin1");for(const word of ["Additional respite","weekend with staff","support and transport","included","Monday 7 September to Wednesday","9 September 2026"])expect(pdf).toContain(word);expect(pdf).not.toContain("...");});

it.each(["\n", "\r\n", "\r"])("preserves entered description lines and blank lines (%j) within one charge", newline => {
  const input = fixture();
  input.rows[0].service = ["Respite", "", "Transport"].join(newline);
  const pdf = invoicePdf(input).toString("latin1");
  expect(pdf).toContain("149 401 Td (Respite)");
  expect(pdf).toContain("149 377 Td (Transport)");
  expect(pdf.match(/260 [\d.]+ Td \(1.000\)/g)).toHaveLength(1);
  expect(pdf).not.toContain("42 388 m 553 388 l S");
  expect(pdf).toContain("42 364 m 553 364 l S");
});

it("paginates a multiline description without duplicating its charge", () => {
  const input = fixture();
  input.rows[0].service = Array.from({length: 24}, (_, i) => "Detail " + (i + 1)).join("\n");
  const pdf = invoicePdf(input).toString("latin1");
  expect(pdf).toContain("/Count 2");
  for (let i = 1; i <= 24; i++) expect(pdf).toContain("(Detail " + i + ")");
  expect(pdf.match(/260 [\d.]+ Td \(1.000\)/g)).toHaveLength(1);
  expect(pdf).toContain("(TOTAL: GBP 100.00)");
});

it("keeps the reported multiline custom invoice on one page with its payment details", () => {
  const input = fixture();
  input.rows[0].service = "This is a test of multiple line invoices.\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7";
  const pdf = invoicePdf(input).toString("latin1");
  expect(pdf).toContain("/Count 1");
  expect(pdf).toContain("(Line 7)");
  expect(pdf).toContain("(PAYMENT AND DOCUMENT DETAILS)");
  expect(pdf.match(/260 [\d.]+ Td \(1.000\)/g)).toHaveLength(1);
});

it("moves a multiline item together when the current page cannot fit it", () => {
  const input = fixture(8);
  input.rows[7].service = Array.from({length: 8}, (_, i) => "Detail " + i).join("\n");
  const pages = invoicePdf(input).toString("latin1").split("endstream");
  expect(pages[0]).not.toContain("(Detail 0)");
  expect(pages[1]).toContain("(Detail 0)");
  expect(pages[1]).toContain("(Detail 7)");
});

it.each([1, 7, 8, 10, 31, 100])("keeps normal %i-row invoice content and totals clear of the footer", count => {
  const pdf = invoicePdf(fixture(count)).toString("latin1");
  expect(pdf.match(/260 [\d.]+ Td \(1.000\)/g)).toHaveLength(count);
  expect(pdf.match(/\(TOTAL: GBP /g)).toHaveLength(1);
  for (const match of pdf.matchAll(/149 ([\d.]+) Td/g)) expect(Number(match[1])).toBeGreaterThan(78);
  const total = pdf.match(/420 ([\d.]+) Td \(TOTAL:/);
  expect(Number(total?.[1])).toBeGreaterThanOrEqual(232);
});

it("keeps very tall descriptions above the footer without losing or repeating text", () => {
  const input = fixture();
  input.rows[0].service = Array.from({length: 100}, (_, i) => "Detail " + i).join("\n");
  const pdf = invoicePdf(input).toString("latin1");
  for (let i = 0; i < 100; i++) expect(pdf.split("(Detail " + i + ")")).toHaveLength(2);
  for (const match of pdf.matchAll(/149 ([\d.]+) Td/g)) expect(Number(match[1])).toBeGreaterThan(78);
  expect(pdf.match(/260 [\d.]+ Td \(1.000\)/g)).toHaveLength(1);
});
