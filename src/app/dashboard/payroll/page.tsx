import { Header } from "@/components/header";
import { SimpleFinanceConsole } from "@/components/simple-finance-console";
import { PayrollRoundingSettings } from "@/components/payroll-rounding-settings";
import { requirePageCapability, CAPABILITIES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageCapability(CAPABILITIES.PAYROLL_REVIEW);
  return <main className="shell"><Header manager/><div className="content">
    <h1 className="page-title">Payroll</h1>
    <p className="muted">Choose a period, check any warnings, then approve and download the accountant-ready files.</p>
    <div className="toolbar"><a className="btn secondary" href="/dashboard/payroll/transport">Transport setup</a></div><PayrollRoundingSettings/><SimpleFinanceConsole mode="payroll"/>
  </div></main>;
}
