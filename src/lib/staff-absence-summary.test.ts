import {describe,it,expect} from "vitest";
import {absenceSummary,leaveYear,shiftDate,type AbsenceForSummary,type WorkDay} from "./staff-absence-summary";
import {absenceCreateInput,absenceEditInput} from "./staff-absence-input";
const absence=(start:string,end=start,type="SICKNESS",extra:Partial<AbsenceForSummary>={}):AbsenceForSummary=>({id:crypto.randomUUID(),type,startDate:start,endDate:end,approvalStatus:"APPROVED",...extra});
const workDays:WorkDay[]=[];
for(let date="2025-01-01";date<="2027-12-31";date=shiftDate(date,1))if(![0,6].includes(new Date(date).getUTCDay()))workDays.push({date,intervals:[[Date.parse(date+"T09:00Z"),Date.parse(date+"T17:00Z")]]});
const base={today:"2026-02-20",year:leaveYear("2026-02-20"),workDays,knownDate:()=>true,employmentStart:"2025-01-01",entitlementDays:28,carryOverDays:2};
describe("staff holiday and Bradford summary",()=>{
 it("defaults to a calendar year and supports a different start date",()=>{expect(leaveYear("2026-02-20")).toEqual({start:"2026-01-01",end:"2026-12-31"});expect(leaveYear("2026-02-20",4,6)).toEqual({start:"2025-04-06",end:"2026-04-05"})});
 it("calculates spells squared times scheduled days lost",()=>{const s=absenceSummary({...base,absences:[absence("2026-02-02","2026-02-03"),absence("2026-02-09")]});expect(s.bradford).toMatchObject({spells:2,days:3,score:12})});
 it("does not count weekends as lost working days",()=>{expect(absenceSummary({...base,absences:[absence("2026-02-06","2026-02-09")]}).bradford).toMatchObject({spells:1,days:2,score:2})});
 it("merges duplicate, overlapping and weekend-adjacent sickness records",()=>{const s=absenceSummary({...base,absences:[absence("2026-02-06"),absence("2026-02-09"),absence("2026-02-09","2026-02-10")]});expect(s.bradford).toMatchObject({spells:1,days:3,score:3})});
 it("excludes future, cancelled and excluded sickness",()=>{const s=absenceSummary({...base,absences:[absence("2026-02-02",undefined,"SICKNESS",{bradfordExcluded:true}),absence("2026-02-03",undefined,"SICKNESS",{approvalStatus:"REJECTED"}),absence("2026-03-02")]});expect(s.bradford).toMatchObject({spells:0,days:0,score:0,excludedRecords:1})});
 it("clips sickness to the rolling 52-week window",()=>{const start=shiftDate(base.today,-363);const s=absenceSummary({...base,absences:[absence("2025-01-01","2025-02-21"),absence(start)]});expect(s.bradford.start).toBe(start);expect(s.bradford.days).toBe(0)});
 it("separates taken and booked days without double-counting overlapping leave",()=>{const s=absenceSummary({...base,absences:[absence("2026-02-02","2026-02-06","ANNUAL_LEAVE"),absence("2026-02-02",undefined,"ANNUAL_LEAVE"),absence("2026-03-02","2026-03-03","ANNUAL_LEAVE")]});expect(s.taken.days).toBe(5);expect(s.booked.days).toBe(2);expect(s.remainingDays).toBe(23)});
 it("uses fractional days for partial absences and unions duplicate parts",()=>{const a=absence("2026-02-02",undefined,"ANNUAL_LEAVE",{startTime:"09:00",endTime:"13:00"});const s=absenceSummary({...base,absences:[a,{...a,id:"duplicate"}]});expect(s.taken.days).toBe(.5);expect(s.remainingDays).toBe(29.5)});
 it("flags missing patterns instead of inventing a balance or score",()=>{const s=absenceSummary({...base,knownDate:()=>false,absences:[absence("2026-02-02"),absence("2026-02-03",undefined,"ANNUAL_LEAVE")]});expect(s.remainingDays).toBeNull();expect(s.bradford.score).toBeNull();expect(s.bradford.unknownDates).toEqual(["2026-02-02"])});
 it("leaves an unset entitlement unknown",()=>{expect(absenceSummary({...base,entitlementDays:null,absences:[]}).remainingDays).toBeNull()});
 it("clips leave at year and employment boundaries",()=>{const s=absenceSummary({...base,employmentStart:"2026-01-02",employmentEnd:"2026-02-04",absences:[absence("2025-12-29","2026-01-02","ANNUAL_LEAVE"),absence("2026-02-02","2026-02-06","ANNUAL_LEAVE")]});expect(s.taken.days).toBe(4)});
 it("keeps pending leave out of the balance",()=>{expect(absenceSummary({...base,absences:[absence("2026-02-02",undefined,"ANNUAL_LEAVE",{approvalStatus:"PENDING"})]}).remainingDays).toBe(30)});
});
describe("absence editing validation",()=>{
 const values={staffId:"11111111-1111-4111-8111-111111111111",type:"SICKNESS",startDate:"2026-02-02",endDate:"2026-02-03"};
 it("requires a reason for score exclusions",()=>{expect(absenceCreateInput.safeParse({...values,bradfordExcluded:true}).success).toBe(false);expect(absenceCreateInput.safeParse({...values,bradfordExcluded:true,bradfordReason:"Agreed adjustment"}).success).toBe(true)});
 it("requires both partial-day times and valid dates",()=>{expect(absenceCreateInput.safeParse({...values,startTime:"09:00"}).success).toBe(false);expect(absenceCreateInput.safeParse({...values,endDate:"2026-02-01"}).success).toBe(false)});
 it("requires a record version and change reason",()=>{expect(absenceEditInput.safeParse({id:values.staffId,values}).success).toBe(false)});
});
