import { addDays, addMonths, addWeeks, differenceInCalendarDays, eachDayOfInterval, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const OPERATIONS_TIME_ZONE = "Europe/London";
export const MAX_CALENDAR_DAYS = 93;
export type PatternInterval = { id?: string; weekIndex: number; dayOfWeek: number; startTime: string; endTime: string; breakMinutes?: number; premisesName?: string | null; defaultRole?: string | null };
export type GeneratedShift = { intervalId?: string; date: Date; startAt: Date; endAt: Date; expectedClockInFrom: Date; expectedClockInUntil: Date; expectedClockOutFrom: Date; expectedClockOutUntil: Date; generationKey: string; premisesName?: string | null; role?: string | null };
const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
export function assertTime(value:string){if(!timePattern.test(value))throw new Error("INVALID_TIME");}
export function assertCalendarRange(start:Date,end:Date){const days=differenceInCalendarDays(end,start);if(days<0||days>MAX_CALENDAR_DAYS)throw new Error("INVALID_DATE_RANGE");}
function localDateTime(day:Date,time:string,timezone:string){assertTime(time);const local=toZonedTime(day,timezone);const [hours,minutes]=time.split(":").map(Number);local.setHours(hours,minutes,0,0);return fromZonedTime(local,timezone);}
export function generatePatternOccurrences(input:{patternId:string;effectiveStart:Date;effectiveEnd?:Date|null;rangeStart:Date;rangeEnd:Date;timezone?:string;cycleWeeks:number;intervals:PatternInterval[]}):GeneratedShift[]{
 const timezone=input.timezone??OPERATIONS_TIME_ZONE;assertCalendarRange(input.rangeStart,input.rangeEnd);
 const first=input.rangeStart>input.effectiveStart?input.rangeStart:input.effectiveStart;
 const last=input.effectiveEnd&&input.effectiveEnd<input.rangeEnd?input.effectiveEnd:input.rangeEnd;
 if(first>last)return[];
 const patternStart=startOfDay(toZonedTime(input.effectiveStart,timezone));
 return eachDayOfInterval({start:first,end:last}).flatMap(day=>{
   const local=startOfDay(toZonedTime(day,timezone));
   const weekIndex=(Math.floor(differenceInCalendarDays(local,patternStart)/7)%input.cycleWeeks)+1;
   const dayOfWeek=local.getDay();
   return input.intervals.filter(i=>i.weekIndex===weekIndex&&i.dayOfWeek===dayOfWeek).map(interval=>{
     const startAt=localDateTime(day,interval.startTime,timezone),endAt=localDateTime(day,interval.endTime,timezone);
     if(endAt<=startAt)throw new Error("INVALID_INTERVAL");
     const date=new Date(Date.UTC(local.getFullYear(),local.getMonth(),local.getDate()));
     return{intervalId:interval.id,date,startAt,endAt,expectedClockInFrom:new Date(startAt.getTime()-15*60000),expectedClockInUntil:new Date(startAt.getTime()+15*60000),expectedClockOutFrom:new Date(endAt.getTime()-15*60000),expectedClockOutUntil:new Date(endAt.getTime()+60*60000),generationKey:[input.patternId,interval.id??(weekIndex+"-"+dayOfWeek+"-"+interval.startTime),date.toISOString().slice(0,10)].join(":"),premisesName:interval.premisesName,role:interval.defaultRole};
   });
 });
}
export type ReconciliationResult={state:"EXPECTED"|"CLOCKED_IN"|"LATE"|"MISSING_CLOCK_IN"|"MISSING_CLOCK_OUT"|"CLOCKED_OUT";minutesLate:number;minutesShort:number};
export function reconcileAttendance(input:{expectedStartAt:Date;expectedEndAt:Date;now:Date;clockInAt?:Date|null;clockOutAt?:Date|null;graceMinutes?:number}):ReconciliationResult{
 const grace=input.graceMinutes??5;
 if(!input.clockInAt)return{state:input.now.getTime()>input.expectedStartAt.getTime()+grace*60000?"MISSING_CLOCK_IN":"EXPECTED",minutesLate:0,minutesShort:0};
 const minutesLate=Math.max(0,Math.floor((input.clockInAt.getTime()-input.expectedStartAt.getTime())/60000));
 if(input.clockOutAt){const minutesShort=Math.max(0,Math.ceil((input.expectedEndAt.getTime()-input.clockOutAt.getTime())/60000));return{state:"CLOCKED_OUT",minutesLate,minutesShort};}
 if(input.now>input.expectedEndAt)return{state:"MISSING_CLOCK_OUT",minutesLate,minutesShort:0};
 return{state:minutesLate>grace?"LATE":"CLOCKED_IN",minutesLate,minutesShort:0};
}
export type ReadinessInput={cancelled?:boolean;requiredStaffCount:number;assignedStaffCount:number;absentAssignedStaff?:number;requiresCompliance?:boolean;approvedCompliance?:boolean;criticalChecksIncomplete?:number;acknowledgementsRequired?:number;acknowledgementsComplete?:number};
export function calculateReadiness(input:ReadinessInput){
 const blockers:string[]=[],warnings:string[]=[];
 if(input.cancelled)return{level:"CANCELLED" as const,blockers:["operation-cancelled"],warnings};
 if(input.assignedStaffCount-(input.absentAssignedStaff??0)<input.requiredStaffCount)blockers.push("staffing-ratio-not-met");
 if(input.requiresCompliance&&!input.approvedCompliance)blockers.push("approved-compliance-required");
 if((input.criticalChecksIncomplete??0)>0)blockers.push("critical-checks-incomplete");
 if((input.acknowledgementsComplete??0)<(input.acknowledgementsRequired??0))warnings.push("staff-acknowledgements-incomplete");
 return{level:blockers.length?"BLOCKED" as const:warnings.length?"ACTION_REQUIRED" as const:"READY" as const,blockers,warnings};
}
export const operationTransitions:Record<string,readonly string[]>={DRAFT:["PLANNING","CANCELLED"],PLANNING:["AWAITING_APPROVAL","CANCELLED"],AWAITING_APPROVAL:["READY","PLANNING","CANCELLED"],STAFFING_INCOMPLETE:["PLANNING","CANCELLED"],COMPLIANCE_INCOMPLETE:["PLANNING","CANCELLED"],CHECKS_INCOMPLETE:["PLANNING","CANCELLED"],READY:["ACTIVE","PLANNING","CANCELLED"],ACTIVE:["COMPLETED","POST_OPERATION_REVIEW"],POST_OPERATION_REVIEW:["COMPLETED"],COMPLETED:[],CANCELLED:[]};
export function assertOperationTransition(from:string,to:string){if(!operationTransitions[from]?.includes(to))throw new Error("INVALID_OPERATION_TRANSITION");}

export type RecurrenceRule={frequency:"DAILY"|"WEEKLY"|"MONTHLY";interval?:number;count?:number;until?:string};
export function expandRecurrence(startAt:Date,endAt:Date,rule:RecurrenceRule,timezone=OPERATIONS_TIME_ZONE){
 const interval=Math.max(1,Math.min(52,rule.interval??1)),count=Math.max(1,Math.min(90,rule.count??(rule.until?90:1))),until=rule.until?new Date(rule.until):null,duration=endAt.getTime()-startAt.getTime();
 if(duration<=0)throw new Error("INVALID_INTERVAL");
 const originalLocal=toZonedTime(startAt,timezone),results:Array<{startAt:Date;endAt:Date}>=[];
 for(let index=0;index<count;index++){
  const local=rule.frequency==="DAILY"?addDays(originalLocal,index*interval):rule.frequency==="WEEKLY"?addWeeks(originalLocal,index*interval):addMonths(originalLocal,index*interval);
  const nextStart=fromZonedTime(local,timezone);if(until&&nextStart>until)break;results.push({startAt:nextStart,endAt:new Date(nextStart.getTime()+duration)});
 }
 return results;
}
