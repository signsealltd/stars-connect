import {requirePageCapability,CAPABILITIES} from "@/lib/permissions";
import { Header } from "@/components/header";
import { StudentManagerV2 } from "@/components/student-manager-v2";
import Link from "next/link";
export default async function StudentsPage(){
  await requirePageCapability(CAPABILITIES.STUDENTS_VIEW);return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Clients</h1><p className="muted">Manage profiles, expected days, emergency contacts and billing details.</p></div><Link className="btn secondary" href="/dashboard/information-reviews">Annual information reviews</Link></div><StudentManagerV2/></div></main>}
