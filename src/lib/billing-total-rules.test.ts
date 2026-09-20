import {describe,it,expect} from "vitest";
import {manualInvoiceAmounts,needsAmendmentReason} from "./billing-total-rules";
describe("invoice total amendments",()=>{
 it("keeps entered gross totals exact while accounting for VAT",()=>{expect(manualInvoiceAmounts(120,20)).toEqual({quantity:1,unitRate:100,netAmount:100,vatAmount:20,vatRate:20,grossAmount:120});const a=manualInvoiceAmounts(99.99,20);expect(Math.round((a.netAmount+a.vatAmount)*100)).toBe(9999)});
 it("blocks missing, negative, fractional-penny and excessive totals",()=>{for(const n of [0,-1,NaN,Infinity,1.001,1000001])expect(()=>manualInvoiceAmounts(n,0)).toThrow()});
 it("requires reasons for unconfirmed and material changes",()=>{expect(needsAmendmentReason(null,200)).toBe(true);expect(needsAmendmentReason(100,110)).toBe(true);expect(needsAmendmentReason(1000,1050)).toBe(true);expect(needsAmendmentReason(1000,1010)).toBe(false);expect(needsAmendmentReason(100,100)).toBe(false)});
});
