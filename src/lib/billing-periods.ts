export type PeriodInput = { label: string; cycle: "LBE" | "MONTHLY"; invoiceMonth: string; periodStart: string; periodEnd: string };
export const BANK_HOLIDAY_SOURCE = "https://www.gov.uk/bank-holidays.json";
export function lbe2026Periods(): PeriodInput[] {
  const ranges = [["2025-12-29","2026-01-25"],["2026-01-26","2026-02-22"],["2026-02-23","2026-03-29"],["2026-03-30","2026-04-26"],["2026-04-27","2026-05-31"],["2026-06-01","2026-06-28"],["2026-06-29","2026-07-26"],["2026-07-27","2026-08-30"],["2026-08-31","2026-09-27"],["2026-09-28","2026-10-25"],["2026-10-26","2026-11-29"],["2026-11-30","2026-12-27"]];
  return ranges.map(([periodStart,periodEnd],index)=>({label:`LBE — ${new Date(Date.UTC(2026,index,1)).toLocaleDateString("en-GB",{month:"long",year:"numeric",timeZone:"UTC"})}`,cycle:"LBE",invoiceMonth:`2026-${String(index+1).padStart(2,"0")}`,periodStart,periodEnd}));
}
export function monthlyPeriods(year: number): PeriodInput[] {
  return Array.from({length:12},(_,index)=>{
    const month=`${year}-${String(index+1).padStart(2,"0")}`;
    return {label:`Monthly — ${new Date(`${month}-01`).toLocaleDateString("en-GB",{month:"long",year:"numeric",timeZone:"UTC"})}`,cycle:"MONTHLY",invoiceMonth:month,periodStart:`${month}-01`,periodEnd:new Date(Date.UTC(year,index+1,0)).toISOString().slice(0,10)};
  });
}
export function holidaysInPeriod(events: Array<{date:string}>, start: string, end: string) {
  const years=events.map(event=>Number(event.date.slice(0,4)));
  if(!years.length||Number(start.slice(0,4))<Math.min(...years)||Number(end.slice(0,4))>Math.max(...years))throw new Error("Bank holiday data does not cover these dates. Choose a period covered by the GOV.UK feed.");
  return [...new Set(events.map(event=>event.date).filter(date=>date>=start&&date<=end))].sort();
}
export async function englandBankHolidays() {
  const response=await fetch(BANK_HOLIDAY_SOURCE,{signal:AbortSignal.timeout(15000),cache:"no-store"});
  if(!response.ok)throw new Error("Unable to verify England bank holidays. Please try saving the period again.");
  const body=await response.json();
  const events=body["england-and-wales"]?.events as Array<{date:string}>|undefined;
  if(!Array.isArray(events)||events.some(event=>!/^\d{4}-\d{2}-\d{2}$/.test(event.date)))throw new Error("The bank holiday feed could not be verified.");
  return events;
}
