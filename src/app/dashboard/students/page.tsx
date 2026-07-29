import { Header } from "@/components/header";
import { requireRole } from "@/lib/security";
import { StudentManagerV2 } from "@/components/student-manager-v2";
export default async function StudentsPage(){
  await requireRole("MANAGER");return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Students</h1><p className="muted">Manage profiles, expected days, emergency contacts and billing details.</p></div></div><StudentManagerV2/></div></main>}
