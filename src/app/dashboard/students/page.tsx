import { Header } from "@/components/header";
import { StudentManager } from "@/components/student-manager";
export default function StudentsPage(){return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Students</h1><p className="muted">Manage profiles, expected days and attendance details.</p></div></div><StudentManager/></div></main>}
