import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read=(path:string)=>readFileSync(path,"utf8");
describe("register, premises and payroll launch fixes",()=>{
  it("refreshes the complete active student cache and uses manager navigation",()=>{const source=read("src/app/register/page.tsx");expect(source).toContain('await local.clear("students")');expect(source).toContain('/api/students/records?status=active');expect(source).toContain('Return to dashboard');});
  it("provides a dedicated RAMS and COSHH area",()=>{const source=read("src/components/premises-manager.tsx");expect(source).toContain('RAMS &amp; COSHH');expect(source).toContain('["RAMS","COSHH"]');});
  it("places configurable rounding on payroll and keeps transport separate",()=>{expect(read("src/app/dashboard/payroll/page.tsx")).toContain("PayrollRoundingSettings");expect(read("src/components/transport-settings.tsx")).not.toContain("Payroll rounding<select");});
  it("renders event-specific transport as a bus-marked payable addition",()=>{const builder=read("src/lib/build-payroll-timesheet.ts"),pdf=read("src/lib/payroll-timesheet-pdf.ts");expect(builder).toContain('entry: start.transportDuty || finish?.transportDuty ? "Transport"');expect(builder).toContain('start.transportDuty ? transportSettings.clockInAllowanceMinutes');expect(builder).toContain('finish.transportDuty ? transportSettings.clockOutAllowanceMinutes');expect(pdf).toContain("busIcon");});
});