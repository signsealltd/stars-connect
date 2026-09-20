import {Header} from "@/components/header";
import {FleetManager} from "@/components/fleet-manager";
import {CAPABILITIES,requirePageCapability} from "@/lib/permissions";
export default async function Page({searchParams}:{searchParams:Promise<{tab?:string}>}){const {tab}=await searchParams;await requirePageCapability(CAPABILITIES.FLEET_VIEW);return <main className="shell"><Header manager/><div className="content"><a href="/dashboard/premises">Safety & Compliance</a><h1>Fleet</h1><FleetManager initialTab={tab}/></div></main>}
