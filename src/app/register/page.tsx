"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, KeyRound, Search } from "lucide-react";
import { Header } from "@/components/header";
import { localDateKey } from "@/lib/dates";
import { db, saveAttendance, syncNow } from "@/lib/local-db";
import type { AttendanceStatus, LocalAttendance, LocalStudent } from "@/lib/types";

const choices: Array<[AttendanceStatus, string]> = [["PRESENT", "Present"], ["ABSENT", "Absent"], ["OFFSITE", "Offsite"]];
const deviceHeaders = () => ({
  "x-device-id": localStorage.getItem("pulse-device-id") || "",
  authorization: `Bearer ${localStorage.getItem("pulse-device-token") || ""}`,
});

export default function Register() {
  const [unlocked, setUnlocked] = useState(false);
  const [checkingManagerAccess, setCheckingManagerAccess] = useState(true);
  const [pin, setPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [students, setStudents] = useState<LocalStudent[]>([]);
  const [records, setRecords] = useState<Record<string, LocalAttendance>>({});
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState(false);
  const date = localDateKey();

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const user = await response.json();
      if (["MANAGER", "DIRECTOR", "ADMINISTRATOR"].includes(user.role)) setUnlocked(true);
    }).finally(() => setCheckingManagerAccess(false));
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    let active = true;
    (async () => {
      const local = await db();
      let rows = await local.getAll("students");
      if (!rows.length) {
        try {
          const response = await fetch("/api/students?active=true", { headers: deviceHeaders() });
          if (response.ok) {
            rows = await response.json();
            for (const row of rows) await local.put("students", row);
          }
        } catch { /* retain offline cache */ }
      }
      if (!active) return;
      setStudents(rows);
      const attendance = await local.getAllFromIndex("attendance", "by-date", date);
      setRecords(Object.fromEntries(attendance.map((row) => [row.studentId, row])));
    })();
    return () => { active = false; };
  }, [date, unlocked]);

  const visible = useMemo(() => students.filter((student) => student.displayName.toLowerCase().includes(q.toLowerCase())), [students, q]);

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

  async function mark(studentId: string, status: AttendanceStatus) {
    const current = records[studentId];
    const value: LocalAttendance = { id: current?.id || crypto.randomUUID(), studentId, date, status, arrivalTime: status === "PRESENT" ? current?.arrivalTime || new Date().toISOString() : status === "ABSENT" ? undefined : current?.arrivalTime, departureTime: status === "OFFSITE" ? new Date().toISOString() : undefined, note: current?.note, deviceTimestamp: new Date().toISOString(), version: (current?.version || 0) + 1 };
    setRecords((existing) => ({ ...existing, [studentId]: value }));
    await saveAttendance(value);
    void syncNow();
  }

  if (checkingManagerAccess) return <main className="shell"><Header/><div className="content"><div className="empty"><span className="spinner"/> Checking access...</div></div></main>;

  if (!unlocked) return <main className="shell"><Header/><div className="content"><Link href="/" className="muted" style={{ display: "inline-flex", gap: 7, textDecoration: "none" }}><ArrowLeft size={20}/>Kiosk home</Link><section className="card" style={{ maxWidth: 480, margin: "48px auto", padding: 28 }}><KeyRound size={34}/><h1>Staff PIN required</h1><p className="muted">Student names are protected. Ask a staff member to enter their PIN to open the register.</p>{error && <div className="alert alert-error">{error}</div>}<form onSubmit={unlock}><label className="form-label">Staff PIN<input className="field" type="password" inputMode="numeric" autoComplete="off" pattern="\d{4,8}" value={pin} onChange={(event) => setPin(event.target.value)} autoFocus required/></label><button className="btn primary" disabled={unlocking}>{unlocking ? "Checking..." : "Unlock register"}</button></form></section></div></main>;

  return <main className="shell"><Header/><div className="content"><Link href="/" className="muted" style={{ display: "inline-flex", gap: 7, textDecoration: "none" }}><ArrowLeft size={20}/>Kiosk home</Link><div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", margin: "18px 0 22px", gap: 20 }}><div><h1 className="page-title">Student register</h1><p className="muted">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} - changes save automatically</p></div><div style={{ display: "flex", gap: 8 }}><button className="btn secondary" onClick={() => { setUnlocked(false); setStudents([]); setRecords({}); }}>Lock</button><button className="btn primary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>{saved ? <><CheckCircle size={18}/> Saved</> : "Save register"}</button></div></div><label style={{ position: "relative", display: "block", maxWidth: 440, marginBottom: 18 }}><Search size={20} style={{ position: "absolute", left: 14, top: 15 }}/><input className="field" style={{ paddingLeft: 44 }} placeholder="Search students" value={q} onChange={(event) => setQ(event.target.value)}/></label><section className="card">{visible.length ? visible.map((student) => <div className="register-row" key={student.id}><div><b>{student.displayName}</b><div className="muted" style={{ fontSize: 13 }}>Expected today</div></div>{choices.map(([value, label]) => <button key={value} className={`choice ${records[student.id]?.status === value ? "active" : ""}`} onClick={() => mark(student.id, value)}>{label}</button>)}</div>) : <div style={{ padding: 40, textAlign: "center" }}><b>No students found</b><p className="muted">Student records will be downloaded when this tablet next synchronises.</p></div>}</section></div></main>;
}