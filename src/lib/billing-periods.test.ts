import {describe,expect,it} from "vitest";
import {holidaysInPeriod,lbe2026Periods,monthlyPeriods} from "./billing-periods";
import {fundedCountAmounts} from "./funded-days";
describe("configured billing periods and day counts",()=>{
 it("reproduces the supplied LBE schedule without gaps",()=>{const periods=lbe2026Periods();expect(periods).toHaveLength(12);expect(periods[0]).toMatchObject({periodStart:"2025-12-29",periodEnd:"2026-01-25"});expect(periods[4]).toMatchObject({periodStart:"2026-04-27",periodEnd:"2026-05-31"});expect(periods[11].periodEnd).toBe("2026-12-27");for(let i=1;i<periods.length;i++)expect(new Date(periods[i].periodStart).getTime()-new Date(periods[i-1].periodEnd).getTime()).toBe(86400000);});
 it("uses complete calendar months, including leap years",()=>{expect(monthlyPeriods(2028)[1]).toMatchObject({periodStart:"2028-02-01",periodEnd:"2028-02-29"});});
 it("deducts each holiday exactly once at inclusive period boundaries",()=>{const events=[{date:"2025-12-25"},{date:"2026-01-01"},{date:"2026-04-03"},{date:"2026-04-06"},{date:"2026-04-06"},{date:"2026-05-04"}];expect(holidaysInPeriod(events,"2026-04-03","2026-04-06")).toEqual(["2026-04-03","2026-04-06"]);expect(holidaysInPeriod(events,"2025-12-29","2026-01-25")).toEqual(["2026-01-01"]);});
 it("refuses to silently assume no holidays outside feed coverage",()=>{expect(()=>holidaysInPeriod([{date:"2026-01-01"}],"2030-01-01","2030-01-31")).toThrow("does not cover");});
 it("bills an entered count less holidays and management removals",()=>{expect(fundedCountAmounts(20,2,1,100,20)).toMatchObject({quantity:17,netAmount:1700,vatAmount:340,grossAmount:2040});});
 it("supports half-day removals and never invoices negative days",()=>{expect(fundedCountAmounts(10,1,0.5,100,0).quantity).toBe(8.5);expect(fundedCountAmounts(0,2,0,100,0).grossAmount).toBe(0);expect(()=>fundedCountAmounts(3,2,2,100,0)).toThrow();});
});
