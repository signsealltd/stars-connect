"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect,useState } from "react";

export function Header({ manager = false }: { manager?: boolean }) {
  const[role,setRole]=useState<string>();
  const[signingOut,setSigningOut]=useState(false);
  useEffect(()=>{if(manager)fetch("/api/auth/me").then(r=>r.ok?r.json():null).then(d=>setRole(d?.role))},[manager]);
  async function signOut(){
    setSigningOut(true);
    try{await fetch("/api/auth/logout",{method:"POST"});}finally{window.location.assign("/login");}
  }
  return <header className="topbar"><Link href="/" className="brand" aria-label="STARS Connect home"><Image src="/branding/stars-logo.svg" alt="" width={58} height={44} className="brand-logo" priority/><span className="brand-copy">STARS Connect<small>Attendance and Register Management</small></span></Link>{manager&&<nav className="nav" aria-label="Management"><Link href="/dashboard">Dashboard</Link><Link href="/dashboard/visitors">Visitors</Link>{role!=="RECEPTION"&&<><Link href="/dashboard/staff">Staff</Link><Link href="/dashboard/students">Students</Link></>}<Link href="/register">Register</Link><Link href="/live">Live</Link>{role!=="RECEPTION"&&<><Link href="/timesheets">Timesheets</Link><Link href="/dashboard/payroll">Payroll</Link><Link href="/dashboard/billing">Billing</Link><Link href="/reports">Reports</Link><Link href="/dashboard/reports/daily">Daily reports</Link><Link href="/dashboard/conflicts">Conflicts</Link></>}{(role==="ADMINISTRATOR"||role==="DIRECTOR")&&<><Link href="/dashboard/billing/profiles">Billing profiles</Link><Link href="/settings/billing">Billing settings</Link><Link href="/settings/email-reports">Email reports</Link></>}{role==="ADMINISTRATOR"&&<><Link href="/dashboard/devices">Devices</Link><Link href="/settings">Settings</Link><Link href="/dashboard/emails">Emails</Link><Link href="/dashboard/audit">Audit</Link></>}<Link href="/emergency">Emergency</Link></nav>}<div className="topbar-actions"><span>STARS Day Service</span>{manager&&<button type="button" className="sign-out" onClick={signOut} disabled={signingOut}>{signingOut?"Signing out…":"Sign out"}</button>}</div></header>
}
