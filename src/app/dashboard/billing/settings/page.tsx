import Link from "next/link";
import {Header} from "@/components/header";
import {BillingPeriodSetup} from "@/components/billing-period-setup";
import {BillingAutomation} from "@/components/billing-automation";
import {requirePageCapability,CAPABILITIES,hasCapability} from "@/lib/permissions";
export default async function Page(){const user=await requirePageCapability(CAPABILITIES.BILLING_EDIT);return <main className="shell"><Header manager/><div className="content"><Link href="/dashboard/billing">← Create invoices</Link><h1>Billing settings</h1><p>Manage periods, payer details and client rates here.</p><div className="toolbar"><Link className="btn secondary" href="/dashboard/billing/profiles">Clients, payers and rates</Link><Link className="btn secondary" href="/dashboard/billing/runs">Advanced billing and historical periods</Link>{hasCapability(user.role,CAPABILITIES.BILLING_APPROVE,user.permissionOverrides)&&<Link className="btn secondary" href="/settings/billing">Invoice and payment details</Link>}</div><BillingPeriodSetup/><BillingAutomation/></div></main>}
