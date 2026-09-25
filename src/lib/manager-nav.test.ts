import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { activeManagerSection,managerNavForRole } from "./manager-nav";

describe("manager navigation permissions",()=>{
 it("keeps portal access and requests out of People",()=>{const groups=managerNavForRole("ADMINISTRATOR");expect(groups.some(g=>g.label==="Staff portal")).toBe(false);expect(groups.find(g=>g.label==="Settings")?.items.some(i=>i.label==="Portal access")).toBe(true);expect(groups.flatMap(g=>g.items).some(i=>i.label==="Tasks")).toBe(false);expect(groups.find(g=>g.label==="People")?.items.some(i=>i.href==="/dashboard/staff/tasks"||i.href==="/dashboard/staff/access")).toBe(false)});
  it("groups manager modules without exposing administrator settings",()=>{
    const groups=managerNavForRole("MANAGER");
    expect(groups.map(group=>group.label)).toEqual(["Calendar","People","Attendance","Safety & Compliance","Finance","Reports","Settings"]);
    const labels=groups.flatMap(group=>group.items.map(item=>item.label));
    expect(labels).toContain("Payroll");
    expect(labels).toContain("Billing");
    expect(labels).not.toContain("Email");
    expect(labels).not.toContain("Devices");
    expect(labels).not.toContain("Audit Log");
  });
  it("hides payroll and billing from reception",()=>{
    const labels=managerNavForRole("RECEPTION").flatMap(group=>group.items.map(item=>item.label));
    expect(labels).not.toContain("Payroll");
    expect(labels).not.toContain("Billing");
  });
  it("shows email to directors and device/user/audit controls only to administrators",()=>{
    expect(managerNavForRole("DIRECTOR").flatMap(g=>g.items.map(i=>i.label))).toEqual(expect.arrayContaining(["Email","Clocking Photographs"]));
    expect(managerNavForRole("MANAGER").flatMap(g=>g.items.map(i=>i.label))).not.toContain("Clocking Photographs");
    const admin=managerNavForRole("ADMINISTRATOR").flatMap(g=>g.items.map(i=>i.label));
    expect(admin).toEqual(expect.arrayContaining(["Email","Devices","Users & Permissions","Audit Log"]));
  });
});

describe("route-aware active sections",()=>{
  it.each([
    ["/dashboard/staff/abc","People"],["/dashboard/staff/access","Settings"],["/dashboard/staff/tasks","Dashboard"],
    ["/timesheets","Attendance"],
    ["/emergency","Attendance"],
    ["/dashboard/payroll/runs/abc","Finance"],
    ["/dashboard/billing/invoices/abc","Finance"],
    ["/dashboard/reports/daily/abc","Reports"],
    ["/dashboard/settings/email","Settings"],
    ["/dashboard/settings/devices","Settings"],
    ["/dashboard/conflicts","Settings"],
  ])("maps %s to %s",(route,section)=>expect(activeManagerSection(route)).toBe(section));
});

describe("shell structure and interaction hooks",()=>{
  const header=readFileSync(join(process.cwd(),"src/components/header.tsx"),"utf8");
  const home=readFileSync(join(process.cwd(),"src/app/page.tsx"),"utf8");
  it("keeps kiosk operations and a secondary Manager Login without manager navigation",()=>{
    expect(home).toContain('href="/clock"');
    expect(home).toContain('href="/register"');
    expect(home).toContain('href="/visitors"');
    expect(home).toContain('href="/emergency"');
    expect(home).toContain('className="btn secondary" href="/login"');
    expect(home).not.toContain("<Header manager");
  });
  it("supports click, Escape, ARIA expansion and a mobile menu",()=>{
    expect(header).toContain('event.key==="Escape"');
    expect(header).toContain("aria-expanded");
    expect(header).toContain("aria-controls");
    expect(header).toContain("manager-menu-toggle");
    expect(header).toContain("onMouseEnter");
  });
  it("keeps desktop dropdowns open briefly when the pointer leaves",()=>{
    expect(header).toContain("scheduleClose");
    expect(header).toContain("},2000)");
    expect(header).toContain("onMouseLeave");
  });
  it("protects the dashboard shell server-side",()=>{
    expect(readFileSync(join(process.cwd(),"src/app/dashboard/layout.tsx"),"utf8")).toContain('if(!session)redirect("/login")');
  });
});

it("places the calendar directly in navigation and RAMS under safety",()=>{const groups=managerNavForRole("ADMINISTRATOR");expect(groups.some(g=>g.label==="Development")).toBe(false);expect(groups.find(g=>g.label==="Calendar")?.href).toBe("/dashboard/calendar");expect(groups.find(g=>g.label==="Safety & Compliance")?.items.some(i=>i.href==="/dashboard/premises")).toBe(true);expect(activeManagerSection("/dashboard/calendar")).toBe("Calendar")});
