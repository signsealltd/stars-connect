import {describe,it,expect} from "vitest";
import {medicationEstimate,medicationInput} from "./medication";
import {ownHrChange,ownMedical} from "./staff-hr";
import {hasCapability,CAPABILITIES as C} from "./permission-catalog";
import {canReviewStaffRequest} from "./staff-task-access";
import type {User} from "@prisma/client";
const now=new Date('2026-09-21T00:00:00Z');
const base={quantity:28,confirmedAt:now,dose:1,administrations:1,weekdayUsage:null,prn:false,manualDailyUsage:null,status:"ACTIVE",reminderDays:14,confirmationDays:30};
describe("medication stock estimates",()=>{
 it("calculates standard daily usage",()=>expect(medicationEstimate(base,now).daysRemaining).toBe(28));
 it("uses quantity per dose times daily administrations",()=>expect(medicationEstimate({...base,dose:2,administrations:2},now).daysRemaining).toBe(7));
 it("supports liquid and fractional quantities",()=>expect(medicationEstimate({...base,quantity:12.5,dose:2.5,administrations:2},now).daysRemaining).toBe(2.5));
 it("handles varying weekdays without averaging the run-out day",()=>{const r=medicationEstimate({...base,quantity:6,weekdayUsage:[0,2,1,2,1,2,0]},now);expect(r.daysRemaining).toBe(4);expect(r.runOut).toBe("2026-09-25T00:00:00.000Z")});
 it("subtracts projected elapsed usage",()=>expect(medicationEstimate(base,new Date(+now+3*86400000)).estimatedQuantity).toBe(25));
 it("does not invent PRN usage",()=>expect(medicationEstimate({...base,prn:true},now).runOut).toBeNull());
 it("labels a manual PRN estimate",()=>{const r=medicationEstimate({...base,prn:true,manualDailyUsage:2},now);expect(r.daysRemaining).toBe(14);expect(r.label).toContain("Manually");expect(r.reliable).toBe(false)});
 it.each(["PAUSED","DISCONTINUED"])("suppresses %s alerts",status=>expect(medicationEstimate({...base,status},now).priority).toBe("NONE"));
 it.each([{dose:0},{quantity:null},{confirmedAt:null},{quantity:-1},{quantity:Infinity},{confirmedAt:"invalid"},{dose:1e-30}])("handles incomplete or invalid input %j",input=>expect(medicationEstimate({...base,...input},now).runOut).toBeNull());
 it.each([[14,"UPCOMING"],[7,"URGENT"],[3,"CRITICAL"],[0,"CRITICAL"]])("classifies %s days as %s",(quantity,priority)=>expect(medicationEstimate({...base,quantity},now).priority).toBe(priority));
 it("flags elapsed run-out and stale confirmation separately",()=>{const r=medicationEstimate({...base,quantity:1},new Date(+now+31*86400000));expect(r.priority).toBe("OVERDUE");expect(r.confirmationOverdue).toBe(true);expect(r.reliable).toBe(false)});
 it("rejects negative weekday quantities",()=>expect(medicationInput.safeParse({weekdayUsage:[-1,0,0,0,0,0,0]}).success).toBe(false));
});
describe("HR privacy and validation",()=>{
 it.each(["jobRole","payrollNumber","employmentStatus","contractType","occupationalHealthNotes","workplaceRestrictions"])("rejects employee submission of %s",field=>expect(ownHrChange.safeParse({key:crypto.randomUUID(),reason:"Change",personal:{[field]:"value"}}).success).toBe(false));
 it("only exposes employee-visible health fields",()=>expect(ownMedical({allergies:"Example",occupationalHealthNotes:"private",reviewDate:"2026-10-01"})).toEqual({allergies:"Example"}));
 it("requires explicit medical access even for directors",()=>{expect(hasCapability("DIRECTOR",C.STAFF_MEDICAL_VIEW)).toBe(false);expect(hasCapability("MANAGER",C.STAFF_MEDICAL_VIEW,{[C.STAFF_MEDICAL_VIEW]:true})).toBe(true);expect(hasCapability("ADMINISTRATOR",C.STAFF_MEDICAL_VIEW,{[C.STAFF_MEDICAL_VIEW]:false})).toBe(true)});
 it("prevents general profile reviewers reading medical submissions",()=>{const user={id:"u",role:"MANAGER",organisationId:"org",permissionOverrides:{[C.STAFF_PROFILE_APPROVE]:true}} as unknown as User;const r={type:"PROFILE",organisationId:"org",involvedUserIds:[],details:{hr:true,proposed:{medical:{allergies:"Test"}}}};expect(canReviewStaffRequest(user,r)).toBe(false);expect(canReviewStaffRequest({...user,permissionOverrides:{[C.STAFF_PROFILE_APPROVE]:true,[C.STAFF_MEDICAL_VIEW]:true}},r)).toBe(true)});
});
