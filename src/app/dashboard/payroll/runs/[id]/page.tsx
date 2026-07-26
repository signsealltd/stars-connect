import { Header } from "@/components/header";
import { FinanceRunReview } from "@/components/finance-run-review";
import { CAPABILITIES, requireCapability } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability(CAPABILITIES.PAYROLL_REVIEW);
  const { id } = await params;
  return <main className="shell"><Header manager/><div className="content"><FinanceRunReview mode="payroll" id={id}/></div></main>;
}
