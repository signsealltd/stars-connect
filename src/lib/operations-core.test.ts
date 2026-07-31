import { describe, expect, it } from "vitest";
import { CAPABILITIES, hasCapability } from "@/lib/permissions";
import { assertCalendarRange, assertOperationTransition, expandRecurrence, calculateReadiness, generatePatternOccurrences, reconcileAttendance } from "@/lib/operations-core";

describe("operations scheduling core",()=>{
 it("generates fixed weekly shifts and multiple intervals",()=>{
  const shifts=generatePatternOccurrences({patternId:"p1",effectiveStart:new Date("2026-08-03T00:00:00Z"),rangeStart:new Date("2026-08-03T00:00:00Z"),rangeEnd:new Date("2026-08-10T00:00:00Z"),timezone:"Europe/London",cycleWeeks:1,intervals:[{id:"am",weekIndex:1,dayOfWeek:1,startTime:"08:00",endTime:"12:00"},{id:"pm",weekIndex:1,dayOfWeek:1,startTime:"13:00",endTime:"17:00"}]});
  expect(shifts).toHaveLength(4);expect(shifts[0].startAt.toISOString()).toBe("2026-08-03T07:00:00.000Z");expect(new Set(shifts.map(s=>s.generationKey)).size).toBe(4);
 });
 it("preserves UK local time over daylight-saving changes",()=>{
  const shifts=generatePatternOccurrences({patternId:"p",effectiveStart:new Date("2026-10-19T00:00:00Z"),rangeStart:new Date("2026-10-19T00:00:00Z"),rangeEnd:new Date("2026-11-02T00:00:00Z"),timezone:"Europe/London",cycleWeeks:1,intervals:[{weekIndex:1,dayOfWeek:1,startTime:"08:30",endTime:"16:30"}]});
  expect(shifts.map(s=>s.startAt.toISOString())).toEqual(["2026-10-19T07:30:00.000Z","2026-10-26T08:30:00.000Z","2026-11-02T08:30:00.000Z"]);
 });
 it("honours effective end date",()=>{expect(generatePatternOccurrences({patternId:"p",effectiveStart:new Date("2026-08-03"),effectiveEnd:new Date("2026-08-03"),rangeStart:new Date("2026-08-03"),rangeEnd:new Date("2026-08-31"),cycleWeeks:1,intervals:[{weekIndex:1,dayOfWeek:1,startTime:"09:00",endTime:"17:00"}]})).toHaveLength(1);});
 it("detects expected, late, missing and completed clocking states",()=>{
  const base={expectedStartAt:new Date("2026-08-03T08:00:00Z"),expectedEndAt:new Date("2026-08-03T16:00:00Z")};
  expect(reconcileAttendance({...base,now:new Date("2026-08-03T08:03:00Z")} ).state).toBe("EXPECTED");
  expect(reconcileAttendance({...base,now:new Date("2026-08-03T08:30:00Z")} ).state).toBe("MISSING_CLOCK_IN");
  expect(reconcileAttendance({...base,now:new Date("2026-08-03T12:00:00Z"),clockInAt:new Date("2026-08-03T08:10:00Z")}).state).toBe("LATE");
  expect(reconcileAttendance({...base,now:new Date("2026-08-03T17:00:00Z"),clockInAt:new Date("2026-08-03T08:00:00Z"),clockOutAt:new Date("2026-08-03T15:45:00Z")})).toMatchObject({state:"CLOCKED_OUT",minutesShort:15});
 });
 it("calculates explicit readiness blockers and warnings",()=>{
  expect(calculateReadiness({requiredStaffCount:3,assignedStaffCount:2,requiresCompliance:true,approvedCompliance:false,criticalChecksIncomplete:1,acknowledgementsRequired:3,acknowledgementsComplete:2})).toEqual({level:"BLOCKED",blockers:["staffing-ratio-not-met","approved-compliance-required","critical-checks-incomplete"],warnings:["staff-acknowledgements-incomplete"]});
  expect(calculateReadiness({requiredStaffCount:2,assignedStaffCount:2})).toEqual({level:"READY",blockers:[],warnings:[]});
 });
 it("expands bounded recurring operations without shifting UK local time",()=>{const rows=expandRecurrence(new Date("2026-10-19T08:00:00Z"),new Date("2026-10-19T09:00:00Z"),{frequency:"WEEKLY",count:3},"Europe/London");expect(rows.map(r=>r.startAt.toISOString())).toEqual(["2026-10-19T08:00:00.000Z","2026-10-26T09:00:00.000Z","2026-11-02T09:00:00.000Z"]);});
 it("enforces workflow transitions and bounded calendar ranges",()=>{
  expect(()=>assertOperationTransition("DRAFT","ACTIVE")).toThrow("INVALID_OPERATION_TRANSITION");expect(()=>assertOperationTransition("READY","ACTIVE")).not.toThrow();
  expect(()=>assertCalendarRange(new Date("2026-01-01"),new Date("2026-06-01"))).toThrow("INVALID_DATE_RANGE");
 });
 it("enforces operational permission defaults and per-user overrides",()=>{expect(hasCapability("RECEPTION",CAPABILITIES.OPERATIONS_VIEW)).toBe(false);expect(hasCapability("MANAGER",CAPABILITIES.OPERATIONS_CREATE)).toBe(true);expect(hasCapability("MANAGER",CAPABILITIES.OPERATIONS_APPROVE)).toBe(false);expect(hasCapability("DIRECTOR",CAPABILITIES.OPERATIONS_APPROVE)).toBe(true);expect(hasCapability("DIRECTOR",CAPABILITIES.CALENDAR_VIEW,{[CAPABILITIES.CALENDAR_VIEW]:false})).toBe(false);});
});
