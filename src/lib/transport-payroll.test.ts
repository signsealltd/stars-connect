import{describe,expect,it}from"vitest";import{calculatePayroll}from"./payroll";
const event=(type:"CLOCK_IN"|"CLOCK_OUT",transportDuty:boolean,at:string)=>({id:type,type,deviceTimestamp:new Date(at),transportDuty});
const options={ordinaryDailyMinutes:480,longShiftMinutes:720,shortShiftMinutes:120,transportClockInMinutes:30,transportClockOutMinutes:45,roundingIntervalMinutes:15,roundingMode:"NEAREST"as const};
describe("transport payroll review",()=>{
 it("adds only the before-shift allowance when selected at clock-in",()=>{const r=calculatePayroll([event("CLOCK_IN",true,"2026-07-29T08:00:00Z"),event("CLOCK_OUT",false,"2026-07-29T15:07:00Z")],[],options);expect(r.originalWorkedMinutes).toBe(427);expect(r.transportMinutes).toBe(30);expect(r.preRoundedMinutes).toBe(457);expect(r.totalPayableMinutes).toBe(450)});
 it("adds only the after-shift allowance when selected at clock-out",()=>{const r=calculatePayroll([event("CLOCK_IN",false,"2026-07-29T08:00:00Z"),event("CLOCK_OUT",true,"2026-07-29T15:07:00Z")],[],options);expect(r.transportMinutes).toBe(45)});
 it("adds both allowances when selected at both events",()=>{const r=calculatePayroll([event("CLOCK_IN",true,"2026-07-29T08:00:00Z"),event("CLOCK_OUT",true,"2026-07-29T15:07:00Z")],[],options);expect(r.transportMinutes).toBe(75)});
});