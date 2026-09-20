import {requirePageCapability,CAPABILITIES} from "@/lib/permissions";
import { Header } from "@/components/header";
import { StaffManager } from "@/components/staff-manager";
import Link from "next/link";

export default async function StaffPage() {
  await requirePageCapability(CAPABILITIES.STAFF_VIEW);
  return <main className="shell"><Header manager /><div className="content">
    <div className="page-head"><div><h1 className="page-title">Staff</h1><p className="muted">Manage staff profiles, working days, holidays, sickness and clocking access.</p></div></div>
    <div className="toolbar"><Link className="btn secondary" href="/timesheets">View Timesheets</Link><Link className="btn secondary" href="/dashboard/payroll">View Payroll History</Link></div><StaffManager />
  </div></main>;
}
