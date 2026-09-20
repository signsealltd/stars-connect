import {describe,it,expect} from "vitest";
import {allocatedOn,dateKeys,fundedAmounts,fundedRuleForDate,needsPurchaseOrder,type Allocation} from "./funded-days";
const rule:Allocation={id:"one",active:true,activeFrom:new Date("2026-09-01"),activeTo:null,applicableWeekdays:[1,3,5],attendanceDependency:"FUNDED",unitType:"DAY",rate:100,vatRate:0};
describe("funded-day billing",()=>{
 it("calculates the entire allocation without attendance input",()=>{const dates=dateKeys(new Date("2026-09-01"),new Date("2026-09-30")).filter(d=>allocatedOn(rule,d));expect(dates).toHaveLength(13);expect(dates.reduce(n=>n+fundedAmounts(rule).grossAmount,0)).toBe(1300)});
 it("respects the effective date of a changed agreement",()=>{const newer={...rule,id:"two",activeFrom:new Date("2026-09-15"),rate:120};expect(fundedRuleForDate([rule,newer],new Date("2026-09-14"))?.id).toBe("one");expect(fundedRuleForDate([rule,newer],new Date("2026-09-15"))?.id).toBe("two")});
 it("does not infer funding from legacy attendance rules or empty weekdays",()=>{expect(fundedRuleForDate([{...rule,attendanceDependency:"ATTENDED"}],new Date("2026-09-02"))).toBeUndefined();expect(allocatedOn({...rule,applicableWeekdays:[]},new Date("2026-09-02"))).toBe(false)});
 it("handles leap months and rejects unbounded periods",()=>{expect(dateKeys(new Date("2028-02-01"),new Date("2028-02-29"))).toHaveLength(29);expect(()=>dateKeys(new Date("2026-01-01"),new Date("2028-01-01"))).toThrow()});
 it("requires PO references for Enfield and LBE",()=>{expect(needsPurchaseOrder("London Borough of Enfield")).toBe(true);expect(needsPurchaseOrder("LBE")).toBe(true);expect(needsPurchaseOrder("Private payer")).toBe(false)});
});
