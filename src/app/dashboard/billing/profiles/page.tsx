import { Header } from "@/components/header";
import { SimpleBillingProfilesV2 } from "@/components/simple-billing-profiles-v2";
import { requireCapability, CAPABILITIES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ studentId?: string; returnTo?: string }> }) {
  await requireCapability(CAPABILITIES.BILLING_APPROVE);
  const query = await searchParams;
  const safeReturn = query.returnTo?.startsWith("/dashboard/billing/") ? query.returnTo : "";
  return <main className="shell"><Header manager/><div className="content">
    <h1 className="page-title">Billing setup</h1>
    <p className="muted">Tell STARS Connect who pays for each service user and what rate to charge.</p>
    <SimpleBillingProfilesV2 initialStudentId={query.studentId} returnTo={safeReturn}/>
  </div></main>;
}
