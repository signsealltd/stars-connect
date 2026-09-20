import {describe,it,expect} from "vitest";
import {inlineBillingSchema} from "./student-management";
const base={payerType:"Local authority",payerName:"Test payer",billingAddress:"Test address",activeFrom:"2026-09-01",vatTreatment:"EXEMPT",vatRate:0,rate:100};
describe("optional funded day count",()=>{
 it("stores an omitted or blank count as unconfirmed, not zero",()=>{expect(inlineBillingSchema.parse(base).fundedDayCount).toBeNull();expect(inlineBillingSchema.parse({...base,fundedDayCount:null}).fundedDayCount).toBeNull()});
 it("preserves an explicitly entered zero",()=>expect(inlineBillingSchema.parse({...base,fundedDayCount:0}).fundedDayCount).toBe(0));
 it("continues validating entered counts",()=>{for(const fundedDayCount of [-1,367,1.3])expect(inlineBillingSchema.safeParse({...base,fundedDayCount}).success).toBe(false);expect(inlineBillingSchema.parse({...base,fundedDayCount:12.5}).fundedDayCount).toBe(12.5)});
});
