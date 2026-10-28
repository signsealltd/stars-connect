"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, KeyRound, Search, UserPlus } from "lucide-react";
import { Header } from "@/components/header";
import { isExpectedDay, localDateKey } from "@/lib/dates";
import { db, saveAttendance, syncNow } from "@/lib/local-db";
import type { AttendanceStatus, LocalAttendance, LocalStudent } from "@/lib/types";

type RegisterAction = AttendanceStatus | "DEPARTED";
const choices: Array<[RegisterAction, string]> = [["PRESENT", "Present"], ["ABSENT", "Absent"], ["OFFSITE", "Offsite"], ["DEPARTED", "Departed"]];
const deviceHeaders = () => ({
  "x-device-id": localStorage.getItem("pulse-device-id") || "",
  authorization: `Bearer ${localStorage.getItem("pulse-device-token") || ""}`,
});

export default function Register() {
  const [unlocked, setUnlocked] = useState(false);
  const [checkingManagerAccess, setCheckingManagerAccess] = useState(true);
  const [managerAccess, setManagerAccess] = useState(false);
  const [pin, setPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [students, setStudents] = useState<LocalStudent[]>([]);
  const [records, setRecords] = useState<Record<string, LocalAttendance>>({});
  const [q, setQ] = useState("");
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraQuery, setExtraQuery] = useState("");
  const [marking, setMarking] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const date = localDateKey();

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const user = await response.json();
      if (["MANAGER", "DIRECTOR", "ADMINISTRATOR"].includes(user.role)) { setManagerAccess(true); setUnlocked(true); }
    }).finally(() => setCheckingManagerAccess(false));
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    let active = true;
    (async () => {
      const local = await db();
      let rows = await local.getAll("students");
      try {
        const response = await fetch(managerAccess ? "/api/students/records?status=active" : "/api/students?active=true", { headers: managerAccess ? undefined : deviceHeaders(), cache: "no-store" });
        if (response.ok) {
          rows = await response.json();
          await local.clear("students");
          for (const row of rows) await local.put("students", row);
        }
      } catch { /* retain the complete offline cache */ }
      if (!active) return;
      setStudents(rows);
      const attendance = await local.getAllFromIndex("attendance", "by-date", date);
      setRecords(Object.fromEntries(attendance.map((row) => [row.studentId, row])));
    })();
    return () => { active = false; };
  }, [date, managerAccess, unlocked]);

  const extraClients = students.filter(student=>!isExpectedDay(student.expectedDays,date)&&!records[student.id]&&student.displayName.toLowerCase().includes(extraQuery.toLowerCase()));

  const visible = useMemo(() => students.filter((student) => (isExpectedDay(student.expectedDays, date) || Boolean(records[student.id])) && student.displayName.toLowerCase().includes(q.toLowerCase())), [date, records, students, q]);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setUnlocking(true); setError("");
    try {
      const response = await fetch("/api/register/unlock", { method: "POST", headers: { ...deviceHeaders(), "content-type": "application/json" }, body: JSON.stringify({ pin }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to unlock the register.");
      setPin(""); setUnlocked(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to unlock the register."); }
    finally { setUnlocking(false); }
  }

  async function mark(studentId: string, action: RegisterAction, extra = false) {
    if (marking) return;
    setMarking(true); setError("");
    try {
    const current = records[studentId];
    if (action === "DEPARTED" && !current?.arrivalTime) return;
    const now = new Date().toISOString();
    const status: AttendanceStatus = action === "DEPARTED" ? (current?.status === "LATE" ? "LATE" : "PRESENT") : action;
    const value: LocalAttendance = { extraDay: extra || current?.extraDay || false, id: current?.id || crypto.randomUUID(), studentId, date, status, arrivalTime: status === "PRESENT" || status === "LATE" ? current?.arrivalTime || now : status === "ABSENT" ? undefined : current?.arrivalTime, departureTime: action === "DEPARTED" || status === "OFFSITE" ? now : undefined, note: action === "DEPARTED" ? "Departed" : current?.note === "Departed" ? undefined : current?.note, deviceTimestamp: now, version: (current?.version || 0) + 1 };
    await saveAttendance(value);
    setRecords((existing) => ({ ...existing, [studentId]: value }));
    if (extra) {setExtraOpen(false);setExtraQuery("");setQ("");setNotice(`${students.find(s=>s.id===studentId)?.displayName || "Client"} added for today and marked present. This extra day will be included in billing at their agreed day rate. Their regular schedule is unchanged.`);}
    void syncNow();
    } catch (cause) {setError(cause instanceof Error ? cause.message : "Unable to save attendance. Please try again.");}
    finally {setMarking(false);}
  }

  if (checkingManagerAccess) return <main className="shell"><Header/><div className="content"><div className="empty"><span className="spinner"/> Checking access...</div></div></main>;

  if (!unlocked) return <main className="shell"><Header/><div className="content"><Link href="/" className="muted" style={{ display: "inline-flex", gap: 7, textDecoration: "none" }}><ArrowLeft size={20}/>Kiosk home</Link><section className="card" style={{ maxWidth: 480, margin: "48px auto", padding: 28 }}><KeyRound size={34}/><h1>Staff PIN required</h1><p className="muted">Client names are protected. Ask a staff member to enter their PIN to open the register.</p>{error && <div className="alert alert-error">{error}</div>}<form autoComplete="off" onSubmit={unlock}><label className="form-label">Staff PIN<input className="field" type="password" inputMode="numeric" autoComplete="off" pattern="\d{4,8}" value={pin} onChange={(event) => setPin(event.target.value)} autoFocus required/></label><button className="btn primary" disabled={unlocking}>{unlocking ? "Checking..." : "Unlock register"}</button></form></section></div></main>;

  return <main className="shell"><Header/><div className="content"><Link href={managerAccess ? "/dashboard" : "/"} className="muted" style={{ display: "inline-flex", gap: 7, textDecoration: "none" }}><ArrowLeft size={20}/>{managerAccess ? "Return to dashboard" : "Kiosk home"}</Link><div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", margin: "18px 0 22px", gap: 20 }}><div><h1 className="page-title">Client register</h1><p className="muted">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} - changes save automatically</p></div><div style={{ display: "flex", gap: 8 }}>{!managerAccess && <button className="btn secondary" onClick={() => { setUnlocked(false); setStudents([]); setRecords({}); setExtraOpen(false); setExtraQuery(""); setNotice(""); setError(""); }}>Lock</button>}<button className="btn primary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>{saved ? <><CheckCircle size={18}/> Saved</> : "Save register"}</button></div></div>{error&&<p role="alert" className="alert alert-error">{error}</p>}{notice&&<p role="status" className="alert">{notice}</p>}<section className="card" style={{padding:20,marginBottom:18,border:"2px solid var(--primary, #7b2b91)"}}><div style={{display:"flex",gap:16,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}><div><h2 style={{margin:0}}>Extra day attendance</h2><p className="muted" style={{marginBottom:0}}>Client attending on a day they are not normally scheduled? Add them here for today only.</p></div><button className="btn primary" aria-expanded={extraOpen} aria-controls="extra-day-clients" onClick={()=>setExtraOpen(!extraOpen)}><UserPlus size={20}/>{extraOpen?"Close extra-day list":"Add client for an extra day"}</button></div>{extraOpen&&<div id="extra-day-clients" style={{marginTop:18}}><label>Find a client not scheduled today<input className="field" autoComplete="off" placeholder="Search client name" value={extraQuery} onChange={event=>setExtraQuery(event.target.value)}/></label><p className="muted">Only clients not already on today&apos;s register are shown. Add and mark present records their arrival now and adds one extra day for billing at their agreed day rate to their usual payer.</p><div style={{maxHeight:360,overflowY:"auto"}}>{extraClients.map(student=><div key={student.id} style={{display:"flex",gap:12,justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid #eee",flexWrap:"wrap"}}><strong>{student.displayName}</strong><button className="btn secondary" disabled={marking} onClick={()=>void mark(student.id,"PRESENT",true)} aria-label={`Add ${student.displayName} for an extra day and mark present`}>Add and mark present</button></div>)}{!extraClients.length&&<p>No additional clients match. Clients already recorded are in the register below. If a client is missing, connect to refresh the client list.</p>}</div></div>}</section><label style={{ position: "relative", display: "block", maxWidth: 440, marginBottom: 18 }}><Search size={20} style={{ position: "absolute", left: 14, top: 15 }}/><input autoComplete="off" className="field" style={{ paddingLeft: 44 }} placeholder="Search clients" value={q} onChange={(event) => setQ(event.target.value)}/></label><section className="card">{visible.length ? visible.map((student) => <div className="register-row" key={student.id}><div><b>{student.displayName}</b><div className="muted" style={{ fontSize: 13 }}>{isExpectedDay(student.expectedDays, date) ? "Expected today" : "Extra day - Attendance already recorded"}</div></div>{choices.map(([value, label]) => { const record = records[student.id]; const active = value === "DEPARTED" ? !!record?.departureTime && record.note === "Departed" : record?.status === value && record.note !== "Departed"; return <button key={value} className={`choice ${active ? "active" : ""}`} disabled={marking || (value === "DEPARTED" && !record?.arrivalTime)} title={value === "DEPARTED" && !record?.arrivalTime ? "Mark the client present before recording departure." : undefined} onClick={() => mark(student.id, value)}>{label}</button>; })}</div>) : <div style={{ padding: 40, textAlign: "center" }}><b>No clients found</b><p className="muted">Client records will be downloaded when this tablet next synchronises.</p></div>}</section></div></main>;
}