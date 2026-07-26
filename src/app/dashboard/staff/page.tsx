import { Header } from "@/components/header";
import { requireRole } from "@/lib/security";
import { StaffManager } from "@/components/staff-manager";
import Link from "next/link";

export default async function StaffPage() {
  await requireRole("MANAGER");
  return <main className="shell"><Header manager /><div className="content">
    <div className="page-head"><div><h1 className="page-title">Staff</h1><p className="muted">Manage staff profiles, clocking access and PIN credentials.</p></div></div>
    <div className="toolbar"><Link className="btn secondary" href="/timesheets">View Timesheets</Link><Link className="btn secondary" href="/dashboard/payroll">View Payroll History</Link></div><StaffManager />
  </div></main>;
}
