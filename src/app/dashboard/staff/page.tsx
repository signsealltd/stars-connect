import { Header } from "@/components/header";
import { StaffManager } from "@/components/staff-manager";

export default function StaffPage() {
  return <main className="shell"><Header manager /><div className="content">
    <div className="page-head"><div><h1 className="page-title">Staff</h1><p className="muted">Manage staff profiles, clocking access and PIN credentials.</p></div></div>
    <StaffManager />
  </div></main>;
}
