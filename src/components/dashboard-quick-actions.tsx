"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Settings2, Siren } from "lucide-react";

type Option = { id: string; label: string; href: string };
type Preferences = { colourMode: "light"|"dark"|"system"; quickActions: string[]; options: Option[] };

export function DashboardQuickActions({ emergencyActive = false, role = "RECEPTION" }: { emergencyActive?: boolean; role?: string }) {
  const [preferences, setPreferences] = useState<Preferences>();
  const [editing, setEditing] = useState(false);
  useEffect(()=>{fetch("/api/preferences").then(r=>r.json()).then(setPreferences)},[]);
  if(!preferences)return <section className="card" style={{padding:22}}><h2>Quick actions</h2><p className="muted">Loading…</p></section>;
  const allowedIds=role==="ADMINISTRATOR"?preferences.options.map(item=>item.id):role==="DIRECTOR"?["register","live","emergency","reports","staff","students","visitors","training","premises"]:role==="MANAGER"?["register","live","emergency","reports","staff","students","visitors","training"]:["register","live","emergency","visitors"];
  const available=preferences.options.filter(option=>allowedIds.includes(option.id));
  const selected=available.filter(option=>preferences.quickActions.includes(option.id));
  async function save(){
    if(!preferences)return;
    await fetch("/api/preferences",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({colourMode:preferences.colourMode,quickActions:preferences.quickActions})});
    setEditing(false);
  }
  return <section className="card" style={{padding:22}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}><h2>Quick actions</h2><button className="btn ghost" style={{marginLeft:"auto"}} onClick={()=>setEditing(true)}><Settings2 size={16}/>Edit</button></div>
    {emergencyActive&&<Link className="alert alert-error" style={{display:"flex",marginBottom:12,textDecoration:"none"}} href="/emergency"><Siren size={18}/>Emergency roll call active — open register</Link>}
    <div className="grid">{selected.map(item=><Link className={`btn ${item.id==="emergency"?"danger":"secondary"}`} href={item.href} key={item.id}>{item.label}</Link>)}</div>
    {editing&&<div className="modal-backdrop"><div className="modal"><h2>Edit quick actions</h2><p className="muted">Choose up to six shortcuts for your dashboard.</p><div className="grid">{available.map(item=><label key={item.id}><input type="checkbox" checked={preferences.quickActions.includes(item.id)} disabled={!preferences.quickActions.includes(item.id)&&preferences.quickActions.length>=6} onChange={e=>setPreferences({...preferences,quickActions:e.target.checked?[...preferences.quickActions,item.id]:preferences.quickActions.filter(id=>id!==item.id)})}/> {item.label}</label>)}</div><div className="modal-actions"><button className="btn secondary" onClick={()=>setEditing(false)}>Cancel</button><button className="btn primary" onClick={save}>Save quick actions</button></div></div></div>}
  </section>;
}
