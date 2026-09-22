import {Header} from "@/components/header";
import {Payments} from "@/components/payments";
import {requirePageCapability,CAPABILITIES,hasCapability} from "@/lib/permissions";
export const dynamic="force-dynamic";
export default async function PaymentsPage(){const user=await requirePageCapability(CAPABILITIES.PAYMENTS_VIEW);return <main className="shell"><Header manager/><div className="content"><Payments canRecord={hasCapability(user.role,CAPABILITIES.PAYMENTS_RECORD,user.permissionOverrides)} canReverse={hasCapability(user.role,CAPABILITIES.PAYMENTS_REVERSE,user.permissionOverrides)} canSettings={hasCapability(user.role,CAPABILITIES.PAYMENTS_SETTINGS,user.permissionOverrides)}/></div></main>}
