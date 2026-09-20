import {describe,it,expect} from "vitest";
import {manualBillingPeriodSchema,manualPeriodLabel} from "./billing-date-selection";
import {invoiceDayAmounts} from "./billing-total-rules";
import {dashboardGreeting,dashboardDate} from "./dashboard-presentation";
import {clientTerminology} from "./terminology";
import {APP_VERSION,APP_VERSION_LABEL} from "./app-version";
import packageInfo from "../../package.json";
import {billingHelpForQuestion} from "./billing-help";
import {retrieveCliveKnowledge} from "./clive-knowledge";

describe("V1.5.1 presentation and billing",()=>{
 it("uses UK time for greetings and dates across UTC midnight",()=>{const date=new Date("2026-09-20T23:30:00Z");expect(dashboardGreeting("Barry Hunnings",date)).toBe("Good morning, Barry");expect(dashboardDate(date)).toBe("Monday, 21 September 2026");expect(dashboardGreeting(" ",date)).toBe("Good morning")});
 it("derives all display versions from the package",()=>{expect(APP_VERSION).toBe(packageInfo.version);expect(APP_VERSION_LABEL).toBe(`V${packageInfo.version}`)});
 it("presents legacy report and audit identifiers without mutating contracts",()=>{expect(clientTerminology("STUDENT_UPDATED StudentAttendance studentsPresent")).toBe("CLIENT_UPDATED ClientAttendance clientsPresent")});
 it("accepts custom date ranges and rejects invalid or excessive periods",()=>{expect(manualBillingPeriodSchema.safeParse({periodStart:"2026-09-05",periodEnd:"2026-09-24",cycle:"MONTHLY"}).success).toBe(true);for(const periodEnd of ["2026-02-30","2026-09-01","2027-01-01"]){expect(manualBillingPeriodSchema.safeParse({periodStart:"2026-09-05",periodEnd,cycle:"LBE"}).success).toBe(false)}expect(manualPeriodLabel({periodStart:"2026-09-05",periodEnd:"2026-09-24",cycle:"LBE"})).toContain("5 Sept 2026")});
 it("recalculates adjusted billable days using the configured rate and VAT",()=>{expect(invoiceDayAmounts(3.5,40,20)).toEqual({quantity:3.5,unitRate:40,netAmount:140,vatRate:20,vatAmount:28,grossAmount:168});for(const days of [0,-1,NaN,63])expect(()=>invoiceDayAmounts(days,40,0)).toThrow();expect(()=>invoiceDayAmounts(3,0,0)).toThrow()});
 it("retrieves client guidance for legacy terminology and targeted billing help",()=>{expect(retrieveCliveKnowledge("How do I add a student?","/dashboard/students","ADMINISTRATOR").some(s=>s.title==="Clients")).toBe(true);expect(billingHelpForQuestion("How do I exclude bank holidays?").id).toBe("holidays");expect(billingHelpForQuestion("Where are previous invoices?").id).toBe("history")});
});
