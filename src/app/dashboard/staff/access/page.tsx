import {StaffAreaManager} from "@/components/staff-area-manager";
import {Header} from "@/components/header";
import {requirePageCapability,CAPABILITIES} from "@/lib/permissions";
export default async function Page(){await requirePageCapability(CAPABILITIES.STAFF_ACCESS_MANAGE);return <main className="shell"><Header manager/><div className="content"><StaffAreaManager mode="access"/></div></main>}
