import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {CAPABILITIES,hasCapability} from "./permissions";

describe("per-user capability overrides",()=>{
  it("can grant a capability that the role does not include",()=>{
    expect(hasCapability("RECEPTION",CAPABILITIES.DAILY_REPORT_VIEW,{[CAPABILITIES.DAILY_REPORT_VIEW]:true})).toBe(true);
  });
  it("can remove a capability that the role normally includes",()=>{
    expect(hasCapability("DIRECTOR",CAPABILITIES.BILLING_APPROVE,{[CAPABILITIES.BILLING_APPROVE]:false})).toBe(false);
  });
  it("retains safe role defaults when no override exists",()=>{
    expect(hasCapability("MANAGER",CAPABILITIES.PAYROLL_REVIEW,{})).toBe(true);
    expect(hasCapability("MANAGER",CAPABILITIES.PAYROLL_APPROVE,{})).toBe(false);
  });
});

describe("audit maintenance controls",()=>{
  const source=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
  it("requires the current administrator password before purging",()=>{
    const route=source("src/app/api/system/audit-maintenance/route.ts");
    expect(route).toContain("bcrypt.compare");
    expect(route).toContain("TEST_AUDIT_HISTORY_PURGED");
  });
  it("enforces retention from the protected daily job",()=>{
    expect(source("src/app/api/internal/reports/daily/run/route.ts")).toContain("await enforceAuditRetention()");
  });
});
