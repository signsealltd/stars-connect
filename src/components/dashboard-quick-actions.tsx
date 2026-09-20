"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Settings2, Siren } from "lucide-react";
import { appConfirm } from "@/lib/app-dialog";

type Option = { id: string; label: string; href: string };
type Preferences = { colourMode: "light"|"dark"|"system"; quickActions: string[]; options: Option[] };

export function DashboardQuickActions({ emergency, onEmergencyClosed }: { emergency?: { id: string; missing: number; startedAt: string } | null; role?: string; onEmergencyClosed?: () => void }) {
  const [preferences, setPreferences] = useState<Preferences>();
  const [editing, setEditing] = useState(false);
  const [closingEmergency, setClosingEmergency] = useState(false);
  const [emergencyError, setEmergencyError] = useState("");
  useEffect(()=>{fetch("/api/preferences").then(async r=>{if(!r.ok)throw Error("Unable to load shortcuts.");return r.json()}).then(setPreferences).catch(()=>setEmergencyError("Unable to load quick actions. Refresh to try again."))},[]);
  if(!preferences)return <section className="card dashboard-quick-actions" style={{padding:22}}><h2>Quick actions</h2><p className="muted">{emergencyError||"Loading…"}</p></section>;
  const available=preferences.options;
  const selected=available.filter(option=>preferences.quickActions.includes(option.id));
  async function closeEmergency(){
    if(!emergency || !await appConfirm("End this emergency roll call? The completed snapshot will remain in the audit history.")) return;
    setClosingEmergency(true);
    setEmergencyError("");
    try {
      const response = await fetch("/api/emergency/close", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rollCallId: emergency.id }) });
      const result = await response.json().catch(() => ({}));
      if(!response.ok) throw new Error(result.error || "The emergency roll call could not be ended.");
      onEmergencyClosed?.();
    } catch(error) {
      setEmergencyError(error instanceof Error ? error.message : "The emergency roll call could not be ended.");
    } finally { setClosingEmergency(false); }
  }
  async function save(){
    if(!preferences)return;
    const response=await fetch("/api/preferences",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({colourMode:preferences.colourMode,quickActions:preferences.quickActions})});
    if(!response.ok){setEmergencyError("Unable to save quick actions. Please try again.");return;}
    setEditing(false);
  }
  return <section className="card dashboard-quick-actions" style={{padding:22}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}><h2>Quick actions</h2><button className="btn ghost" style={{marginLeft:"auto"}} onClick={()=>setEditing(true)}><Settings2 size={16}/>Edit</button></div>
    {emergencyError&&!emergency&&<p role="alert">{emergencyError}</p>}{emergency&&<div className="alert alert-error" style={{display:"grid",gap:10,marginBottom:12}}><div style={{display:"flex",gap:8,alignItems:"center"}}><Siren size={18}/><b>Emergency roll call active</b></div><small>Started {new Date(emergency.startedAt).toLocaleString("en-GB")} - {emergency.missing} unaccounted</small><div className="table-actions"><Link className="btn secondary" href="/emergency">Open register</Link><button type="button" className="btn danger" disabled={closingEmergency} onClick={()=>void closeEmergency()}>{closingEmergency?"Ending...":"End roll call"}</button></div>{emergencyError&&<small>{emergencyError}</small>}</div>}
    <div className="dashboard-shortcuts">{selected.map(item=><Link className={`btn ${item.id==="emergency"?"danger":"secondary"}`} href={item.href} key={item.id}>{item.label}</Link>)}</div>
    {editing&&<div className="modal-backdrop"><div className="modal"><h2>Edit quick actions</h2><p className="muted">Choose up to twelve shortcuts for your dashboard.</p><div className="grid">{available.map(item=><label key={item.id}><input type="checkbox" checked={preferences.quickActions.includes(item.id)} disabled={!preferences.quickActions.includes(item.id)&&preferences.quickActions.length>=12} onChange={e=>setPreferences({...preferences,quickActions:e.target.checked?[...preferences.quickActions,item.id]:preferences.quickActions.filter(id=>id!==item.id)})}/> {item.label}</label>)}</div><div className="modal-actions"><button className="btn secondary" onClick={()=>setEditing(false)}>Cancel</button><button className="btn primary" onClick={save}>Save quick actions</button></div></div></div>}
  </section>;
}
