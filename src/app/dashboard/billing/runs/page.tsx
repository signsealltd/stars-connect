import Link from "next/link";
import {Header} from "@/components/header";
import {SimpleFinanceConsole} from "@/components/simple-finance-console";
import {requirePageCapability,CAPABILITIES} from "@/lib/permissions";
export default async function Page(){await requirePageCapability(CAPABILITIES.BILLING_REVIEW);return <main className="shell"><Header manager/><div className="content"><Link href="/dashboard/billing/settings">← Billing settings</Link><h1>Advanced billing</h1><p>Manage existing drafts, revisions and historical periods.</p><SimpleFinanceConsole mode="billing"/></div></main>}
