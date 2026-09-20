import {Header} from "@/components/header";
import {BillingWizard} from "@/components/billing-wizard";
import {requirePageCapability,CAPABILITIES,hasCapability} from "@/lib/permissions";
export const dynamic="force-dynamic";
export default async function Page(){const user=await requirePageCapability(CAPABILITIES.BILLING_REVIEW);const can=(cap:typeof CAPABILITIES[keyof typeof CAPABILITIES])=>hasCapability(user.role,cap,user.permissionOverrides);return <main className="shell"><Header manager/><div className="content" style={{maxWidth:1400}}><BillingWizard canCreate={can(CAPABILITIES.BILLING_APPROVE)&&can(CAPABILITIES.BILLING_EDIT)} canSettings={can(CAPABILITIES.BILLING_EDIT)}/></div></main>}
