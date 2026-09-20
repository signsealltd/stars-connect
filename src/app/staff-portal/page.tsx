import {Header} from "@/components/header";
import {StaffPortal} from "@/components/staff-portal";
import {CAPABILITIES,requirePageCapability} from "@/lib/permissions";
export default async function Page(){const user=await requirePageCapability(CAPABILITIES.STAFF_PORTAL);return <main className="shell"><Header manager/><div className="content"><h1>Staff portal</h1><p>Welcome, {user.name}.</p><StaffPortal/></div></main>}
