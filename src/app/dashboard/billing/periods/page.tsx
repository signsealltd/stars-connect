import { Header } from "@/components/header";
import { BillingPeriodSetup } from "@/components/billing-period-setup";
import { requirePageCapability, CAPABILITIES } from "@/lib/permissions";

export default async function BillingPeriodsPage() {
  await requirePageCapability(CAPABILITIES.BILLING_EDIT);
  return <main className="shell"><Header manager/><div className="content">
    <h1 className="page-title">Billing periods</h1>
    <p className="muted">Manage saved invoice dates and their operational calendar tasks.</p>
    <BillingPeriodSetup initiallyOpen/>
  </div></main>;
}
