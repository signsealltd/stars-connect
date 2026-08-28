import { Header } from "@/components/header";
import { TrainingManager } from "@/components/training-manager";
import { requireRole } from "@/lib/security";
export default async function TrainingPage(){await requireRole("MANAGER");return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Staff training</h1><p className="muted">See training gaps, manage courses and approved providers, and plan renewals from one matrix.</p></div></div><TrainingManager/></div></main>}
