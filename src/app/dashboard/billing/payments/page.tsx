import { Header } from "@/components/header";
import { requirePageCapability, CAPABILITIES } from "@/lib/permissions";
import { ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PaymentsChecklistPage() {
  await requirePageCapability(CAPABILITIES.BILLING_REVIEW);
  return <main className="shell"><Header manager/><div className="content">
    <h1 className="page-title">Payments Checklist</h1>
    <section className="card" style={{padding:32,marginTop:24,borderRadius:20,maxWidth:780}}>
      <ListChecks size={36} style={{color:"var(--primary)",marginBottom:16}} aria-hidden="true"/>
      <h2>Coming soon</h2>
      <p className="muted">A place for management to review incoming funds and match payments to invoices.</p>
    </section>
  </div></main>;
}
