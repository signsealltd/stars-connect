import {SystemTasks} from "@/components/system-tasks";
import {StaffAreaManager} from "@/components/staff-area-manager";
import {Header} from "@/components/header";
import {requirePageCapability,CAPABILITIES} from "@/lib/permissions";
export default async function Page(){await requirePageCapability(CAPABILITIES.STAFF_TASKS);return <main className="shell"><Header manager/><div className="content"><SystemTasks/><StaffAreaManager mode="tasks"/></div></main>}
