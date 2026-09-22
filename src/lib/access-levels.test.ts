import {describe,it,expect} from "vitest";
import {CAPABILITIES,capabilityOptions,hasCapability} from "./permission-catalog";
import {moduleCapability} from "./module-access";
import {managerNavForRole} from "./manager-nav";
describe("staff access levels",()=>{
 it.each(["TEAM_LEADER","CARE_ASSISTANT"] as const)("restricts %s to staff modules by default",role=>{expect(hasCapability(role,CAPABILITIES.STAFF_PORTAL)).toBe(true);expect(hasCapability(role,CAPABILITIES.BILLING_APPROVE)).toBe(false);expect(hasCapability(role,CAPABILITIES.USERS_MANAGE)).toBe(false);expect(hasCapability(role,CAPABILITIES.STUDENT_CARE)).toBe(false)});
 it("honours both explicit grants and explicit restrictions",()=>{expect(hasCapability("TEAM_LEADER",CAPABILITIES.STUDENTS_VIEW,{"students.view":true})).toBe(true);expect(hasCapability("DIRECTOR",CAPABILITIES.BILLING_APPROVE,{"billing.approve":false})).toBe(false);expect(hasCapability("CARE_ASSISTANT",CAPABILITIES.STAFF_POLICIES,{"staff-policies.view":false})).toBe(false)});
 it("provides a control for every capability",()=>{expect(capabilityOptions).toHaveLength(new Set(capabilityOptions.map(o=>o.key)).size);expect(new Set(capabilityOptions.map(o=>o.key))).toEqual(new Set(Object.values(CAPABILITIES)))});
 it("maps read and mutation endpoints to distinct permissions",()=>{expect(moduleCapability("/api/staff/123")).toBe(CAPABILITIES.STAFF_VIEW);expect(moduleCapability("/api/staff/123",true)).toBe(CAPABILITIES.STAFF_MANAGE);expect(moduleCapability("/api/attendance-photos/123")).toBe(CAPABILITIES.PHOTO_VIEW)});
 it("shows modules granted through a custom level and hides denied ones",()=>{const labels=managerNavForRole("TEAM_LEADER",["staff-portal.view","students.view"]).flatMap(g=>g.items.map(i=>i.label));expect(labels).toContain("Clients");expect(labels).not.toContain("Billing");expect(labels).not.toContain("Users & Permissions")});
});

it("always grants administrators every capability despite restrictive overrides",()=>{for(const capability of Object.values(CAPABILITIES))expect(hasCapability("ADMINISTRATOR",capability,{[capability]:false})).toBe(true)});
