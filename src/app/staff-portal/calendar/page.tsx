import {Header} from "@/components/header";
import {OperationalCalendar} from "@/components/operational-calendar";
import {CAPABILITIES,requirePageCapability} from "@/lib/permissions";
export default async function Page(){await requirePageCapability(CAPABILITIES.STAFF_CALENDAR);return <main className="shell"><Header manager/><div className="content"><h1>Operational calendar</h1><OperationalCalendar/></div></main>}
