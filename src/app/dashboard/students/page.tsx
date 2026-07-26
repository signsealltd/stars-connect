import { Header } from "@/components/header";
import { requireRole } from "@/lib/security";
import { StudentManager } from "@/components/student-manager";
export default async function StudentsPage(){
  await requireRole("MANAGER");return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Students</h1><p className="muted">Manage profiles, expected days and attendance details.</p></div></div><StudentManager/></div></main>}
