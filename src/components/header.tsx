"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect,useState } from "react";

export function Header({ manager = false }: { manager?: boolean }) {
  const[role,setRole]=useState<string>();
  useEffect(()=>{if(manager)fetch("/api/auth/me").then(r=>r.ok?r.json():null).then(d=>setRole(d?.role))},[manager]);
  return <header className="topbar"><Link href="/" className="brand" aria-label="STARS Connect home"><Image src="/branding/stars-logo.svg" alt="" width={58} height={44} className="brand-logo" priority/><span className="brand-copy">STARS Connect<small>Attendance and Register Management</small></span></Link>{manager&&<nav className="nav" aria-label="Management"><Link href="/dashboard">Dashboard</Link>{role!=="RECEPTION"&&<><Link href="/dashboard/staff">Staff</Link><Link href="/dashboard/students">Students</Link></>}<Link href="/register">Register</Link><Link href="/live">Live</Link>{role!=="RECEPTION"&&<><Link href="/timesheets">Timesheets</Link><Link href="/reports">Reports</Link><Link href="/dashboard/conflicts">Conflicts</Link></>}{role==="ADMINISTRATOR"&&<><Link href="/dashboard/devices">Devices</Link><Link href="/settings">Settings</Link><Link href="/dashboard/emails">Emails</Link><Link href="/dashboard/audit">Audit</Link></>}<Link href="/emergency">Emergency</Link></nav>}<span style={{fontSize:13,color:"#dfd0e2"}}>STARS Day Service</span></header>
}
