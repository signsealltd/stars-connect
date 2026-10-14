import {SafetyNavigation} from "@/components/safety-navigation";
import "@/app/assets.css";
import {AssetWorkspace} from "@/components/asset-workspace";
import "@/app/safety.css";
import {SafetyHub} from "@/components/safety-hub";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import { Header } from "@/components/header";
import { PremisesManager } from "@/components/premises-manager";
import {getSession} from "@/lib/security";
import {redirect} from "next/navigation";
export const dynamic="force-dynamic";
export default async function PremisesPage({searchParams}:{searchParams:Promise<{section?:string;record?:string;asset?:string}>}){const {section,record,asset}=await searchParams;if(section==="inspections"){const query=new URLSearchParams({section:"assets",view:"checks"});if(record)query.set("inspection",record);if(asset)query.set("asset",asset);redirect("/dashboard/premises?"+query.toString())}const session=await getSession();if(!session)redirect("/login");const user=session.user,canPremises=hasCapability(user.role,CAPABILITIES.PREMISES_VIEW,user.permissionOverrides),canFleet=hasCapability(user.role,CAPABILITIES.FLEET_VIEW,user.permissionOverrides);if(!canPremises&&!canFleet&&!hasCapability(user.role,CAPABILITIES.COMPLIANCE_VIEW,user.permissionOverrides))redirect("/access-denied");return <main className="shell"><Header manager/><div className="content"><SafetyNavigation/>{section!=="assets"&&<div className="page-head"><div><h1 className="page-title">Safety & Compliance</h1><p className="muted">Manage property systems, statutory tests, corrective actions, insurance and renewal dates.</p></div></div>}{section==="assets"&&canPremises?<AssetWorkspace/>:!section?<SafetyHub/>:canPremises?<PremisesManager canFleet={hasCapability(user.role,CAPABILITIES.FLEET_VIEW,user.permissionOverrides)} canRiddor={hasCapability(user.role,CAPABILITIES.STAFF_RIDDOR,user.permissionOverrides)}/>:<section className="card" style={{padding:24}}><h2>Overview</h2><p>Open the areas enabled for your account.</p><a className="btn primary" href="/dashboard/premises/fleet">Fleet</a></section>}</div></main>}