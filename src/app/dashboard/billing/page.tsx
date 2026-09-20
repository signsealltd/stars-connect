import {BillingAutomation} from "@/components/billing-automation";
import { InvoiceArchive } from "@/components/invoice-archive";
import { Header } from "@/components/header";
import { SimpleFinanceConsole } from "@/components/simple-finance-console";
import { requirePageCapability, CAPABILITIES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageCapability(CAPABILITIES.BILLING_REVIEW);
  return <main className="shell"><Header manager/><div className="content">
    <h1 className="page-title">Billing</h1>
    <p className="muted">Invoice agreed funded days. Attendance does not affect charges.</p>
    <BillingAutomation/><SimpleFinanceConsole mode="billing"/><InvoiceArchive/>
  </div></main>;
}
