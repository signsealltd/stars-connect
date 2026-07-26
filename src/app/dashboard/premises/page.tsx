import { Header } from "@/components/header";
import { PremisesManager } from "@/components/premises-manager";
import { requireRole } from "@/lib/security";
export const dynamic="force-dynamic";
export default async function PremisesPage(){await requireRole("DIRECTOR");return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Premises & Compliance</h1><p className="muted">Manage property systems, statutory tests, corrective actions, insurance and renewal dates.</p></div></div><PremisesManager/></div></main>}