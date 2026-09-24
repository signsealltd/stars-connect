import {requirePageCapability,CAPABILITIES,hasCapability} from "@/lib/permissions";
import { Header } from "@/components/header";
import { StaffManager } from "@/components/staff-manager";
import Link from "next/link";

export default async function StaffPage() {
  const user=await requirePageCapability(CAPABILITIES.STAFF_VIEW);
  return <main className="shell"><Header manager /><div className="content">
    <div className="page-head"><div><h1 className="page-title">Staff</h1><p className="muted">Manage staff profiles, working days, holidays, sickness and clocking access.</p></div></div>
    <div className="toolbar"><Link className="btn secondary" href="/dashboard/staff/tasks">Tasks</Link><Link className="btn secondary" href="/dashboard/staff/access">Staff access</Link><Link className="btn secondary" href="/timesheets">View Timesheets</Link><Link className="btn secondary" href="/dashboard/payroll">View Payroll History</Link></div><StaffManager canHr={hasCapability(user.role,CAPABILITIES.STAFF_HR_VIEW,user.permissionOverrides)}/>
  </div></main>;
}
