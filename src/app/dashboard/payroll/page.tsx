import { Header } from "@/components/header";
import { SimpleFinanceConsole } from "@/components/simple-finance-console";
import { requireCapability, CAPABILITIES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireCapability(CAPABILITIES.PAYROLL_REVIEW);
  return <main className="shell"><Header manager/><div className="content">
    <h1 className="page-title">Payroll</h1>
    <p className="muted">Choose a period, check any warnings, then approve and download the accountant-ready files.</p>
    <SimpleFinanceConsole mode="payroll"/>
  </div></main>;
}
