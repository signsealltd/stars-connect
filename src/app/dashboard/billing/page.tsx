import { Header } from "@/components/header";
import { SimpleFinanceConsole } from "@/components/simple-finance-console";
import { requirePageCapability, CAPABILITIES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageCapability(CAPABILITIES.BILLING_REVIEW);
  return <main className="shell"><Header manager/><div className="content">
    <h1 className="page-title">Billing</h1>
    <p className="muted">Create invoices from attendance in three guided steps.</p>
    <SimpleFinanceConsole mode="billing"/>
  </div></main>;
}
