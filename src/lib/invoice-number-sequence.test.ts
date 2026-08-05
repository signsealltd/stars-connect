import{describe,expect,it}from"vitest";
import{invoiceNumber,nextInvoiceSequence}from"./billing";

describe("invoice number allocation",()=>{
  it("continues after the highest surviving invoice rather than the row count",()=>{
    const numbers=["STARS-2026-00001","STARS-2026-00009","STARS-2025-00100"];
    expect(nextInvoiceSequence("STARS",2026,numbers)).toBe(10);
    expect(invoiceNumber("STARS",2026,nextInvoiceSequence("STARS",2026,numbers))).toBe("STARS-2026-00010");
  });
  it("ignores other prefixes and malformed values",()=>{
    expect(nextInvoiceSequence("LBE.STARS",2026,["LBE.STARS-2026-00007","LBE-STARS-2026-99999","LBE.STARS-2026-final"])).toBe(8);
  });
});
