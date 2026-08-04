"use client";import{appConfirm}from"@/lib/app-dialog";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { localDateKey } from "@/lib/dates";
import styles from "./finance-workflow.module.css";

type Mode = "payroll" | "billing";
type Item = { id: string; label?: string; status: string; version: number; periodStart: string; periodEnd: string; _count?: { entries?: number; charges?: number } };

type Student = { id: string; displayName: string; internalReference?: string | null; startDate: string; endDate?: string | null; billingProfile?: { payerName: string } | null };

const label = (status: string) => ({
  DRAFT: "Not prepared", REQUIRES_REVIEW: "Check required", REVIEWED: "Ready",
  APPROVED: "Approved", LOCKED: "Ready to generate", EXPORTED: "Complete", INVOICES_GENERATED: "Complete",
}[status] || status.replaceAll("_", " "));

export function SimpleFinanceConsole({ mode }: { mode: Mode }) {
  const router = useRouter();
  const endpoint = mode === "payroll" ? "/api/payroll/periods" : "/api/billing/runs";
  const [items, setItems] = useState<Item[]>([]);
  const [from, setFrom] = useState(localDateKey());
  const [to, setTo] = useState(localDateKey());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [runLabel, setRunLabel] = useState("");
  const [historicalMode, setHistoricalMode] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [payerFilter, setPayerFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setItems(body);
    else setError(body.error || `Unable to load ${mode}.`);
    setLoading(false);
  }, [endpoint, mode]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (mode !== "billing") return; fetch("/api/students/records?status=active", { cache: "no-store" }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to load students."); setStudents(Array.isArray(body) ? body : []); }).catch(caught => setError(caught instanceof Error ? caught.message : "Unable to load students.")); }, [mode]);
  const payers = [...new Set(students.map(student => student.billingProfile?.payerName).filter((value): value is string => Boolean(value)))].sort();
  const eligibleStudents = students.filter(student => student.startDate.slice(0, 10) <= to && (!student.endDate || student.endDate.slice(0, 10) >= from));
  const visibleStudents = eligibleStudents.filter(student => (payerFilter === "ALL" || student.billingProfile?.payerName === payerFilter) && (!studentSearch.trim() || (student.displayName + " " + (student.internalReference || "")).toLowerCase().includes(studentSearch.trim().toLowerCase())));
  const hiddenSelectedCount = selectedStudentIds.filter(id => !visibleStudents.some(student => student.id === id)).length;
  useEffect(() => {
    const eligibleIds = new Set(students.filter(student => student.startDate.slice(0, 10) <= to && (!student.endDate || student.endDate.slice(0, 10) >= from)).map(student => student.id));
    setSelectedStudentIds(current => { const next = current.filter(id => eligibleIds.has(id)); return next.length === current.length ? current : next; });
  }, [students, from, to]);

  async function prepare() {
    if (mode === "billing" && (!runLabel.trim() || !selectedStudentIds.length)) { setError("Enter a billing run label and select at least one student."); return; }
    setWorking(true); setError("");
    try {
      const created = await fetch(endpoint, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ periodStart: from, periodEnd: to, ...(mode === "billing" ? { label: runLabel.trim(), studentIds: selectedStudentIds, historicalMode } : {}) }),
      });
      const run = await created.json();
      if (!created.ok) throw new Error(run.error || `Unable to create ${mode}.`);
      const calculated = await fetch(`${endpoint}/${run.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "calculate" }),
      });
      const result = await calculated.json();
      if (!calculated.ok) throw new Error(result.error || `The ${mode} run was created but could not be calculated.`);
      router.push(`/dashboard/${mode}/runs/${run.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to prepare ${mode}.`);
      setWorking(false);
    }
  }

  async function refresh(item: Item) {
    if (!await appConfirm("Refresh this run from the latest attendance records?")) return;
    setWorking(true); setError("");
    const response = await fetch(`${endpoint}/${item.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "calculate" }),
    });
    const body = await response.json();
    setWorking(false);
    if (!response.ok) return setError(body.error || "Unable to refresh calculations.");
    router.push(`/dashboard/${mode}/runs/${item.id}`);
  }

  async function deleteRun(event: React.FormEvent) {
    event.preventDefault();
    if (!deleteItem || !deletePassword) return;
    setWorking(true); setError("");
    const response = await fetch(`${endpoint}/${deleteItem.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: deletePassword }) });
    const body = await response.json();
    setWorking(false);
    if (!response.ok) return setError(body.error || `Unable to delete the ${mode} run.`);
    setDeleteItem(null); setDeletePassword(""); await load();
  }
  return <>
    <div className={styles.steps}>
      <div className={`card ${styles.step} ${styles.current}`}><b>1. Choose dates</b><span>Attendance is gathered automatically.</span></div>
      <div className={`card ${styles.step}`}><b>2. Check warnings</b><span>Only missing or unusual information needs attention.</span></div>
      <div className={`card ${styles.step}`}><b>3. Approve and download</b><span>One final action creates the documents.</span></div>
    </div>
    {mode === "billing" && <div className={`alert alert-warning ${styles.help}`}>
      <b>What are payer and billing profiles?</b> The payer is the council, organisation, family member or other party receiving the invoice. A billing profile links that payer and the agreed rate to one service user. It is configured once per service user.
    </div>}
    {mode === "billing" && <section className="card" style={{padding:"18px",marginBottom:"16px"}}>
      <div className="form-grid">
        <label className="form-label">Billing run label<input className="field" maxLength={191} placeholder="For example: LBE - 29 June to 26 July 2026" value={runLabel} onChange={event=>setRunLabel(event.target.value)}/></label>
        <label className="form-label">Payer filter<select className="field" value={payerFilter} onChange={event=>setPayerFilter(event.target.value)}><option value="ALL">All payers</option>{payers.map(payer=><option key={payer} value={payer}>{payer}</option>)}</select></label>
        <label className="form-label">Find student<input className="field" placeholder="Name or student reference" value={studentSearch} onChange={event=>setStudentSearch(event.target.value)}/></label>
        <label className="form-label" style={{alignSelf:"end"}}><span><input type="checkbox" checked={historicalMode} onChange={event=>setHistoricalMode(event.target.checked)}/> Historical attendance (enter attended days manually)</span></label>
      </div>
      <div className="table-actions" style={{margin:"12px 0"}}><button type="button" className="btn secondary" onClick={()=>setSelectedStudentIds(visibleStudents.map(student=>student.id))}>Select shown only</button><button type="button" className="btn secondary" onClick={()=>setSelectedStudentIds([])}>Clear all</button><span className="muted">{selectedStudentIds.length} student{selectedStudentIds.length===1?"":"s"} selected{hiddenSelectedCount>0?` (${hiddenSelectedCount} hidden by the current filter)`:""}</span></div>
      <div style={{maxHeight:"260px",overflow:"auto",border:"1px solid var(--border)",borderRadius:"12px",padding:"8px"}}>{visibleStudents.length?visibleStudents.map(student=><label key={student.id} style={{display:"flex",gap:"10px",alignItems:"center",padding:"9px"}}><input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={event=>setSelectedStudentIds(event.target.checked?[...selectedStudentIds,student.id]:selectedStudentIds.filter(id=>id!==student.id))}/><span><b>{student.displayName}</b>{student.internalReference&&<small className="muted" style={{display:"block"}}>{student.internalReference}</small>}</span><span className="muted" style={{marginLeft:"auto"}}>{student.billingProfile?.payerName||"Billing not configured"}</span></label>):<div className="empty">No students match this filter.</div>}</div>
    </section>}
    <div className="toolbar">
      <label>From<input autoComplete="off" className="field" type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
      <label>To<input autoComplete="off" className="field" type="date" value={to} onChange={event => setTo(event.target.value)}/></label>
      <button className="btn primary" disabled={working || !from || !to || (mode === "billing" && (!runLabel.trim() || !selectedStudentIds.length))} onClick={prepare}>{working ? "Preparing..." : `Prepare ${mode}`}</button>
      {mode === "billing" && <a className="btn secondary" href="/dashboard/billing/profiles">Manage billing setup</a>}
    </div>
    {error && <div className="alert alert-error">{error}</div>}
    <section className="card table-wrap">
      {loading ? <div className="empty">Loading...</div> : items.length ? <table className="table">
        <thead><tr><th>Period</th><th>Status</th><th>Records</th><th>Next action</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id}>
          <td>{mode === "billing" && item.label && <b style={{display:"block"}}>{item.label}</b>}{new Date(item.periodStart).toLocaleDateString("en-GB")} to {new Date(item.periodEnd).toLocaleDateString("en-GB")}</td>
          <td><span className="status-pill">{label(item.status)}</span></td>
          <td>{item._count?.entries ?? item._count?.charges ?? 0}</td>
          <td><div className="table-actions">
            <a className="btn primary" href={`/dashboard/${mode}/runs/${item.id}`}>{["EXPORTED", "INVOICES_GENERATED"].includes(item.status) ? "View completed run" : "Continue"}</a>
            {["DRAFT", "REQUIRES_REVIEW", "REVIEWED"].includes(item.status) && <button className="btn secondary" disabled={working} onClick={() => refresh(item)}>Refresh calculations</button>}<button className="btn danger" disabled={working} onClick={()=>{setDeleteItem(item);setDeletePassword("");setError("")}}>Delete run</button>
          </div></td>
        </tr>)}</tbody>
      </table> : <div className="empty"><b>No {mode} runs yet</b><p>Choose dates above to prepare the first one.</p></div>}
    </section>
    {deleteItem&&<div className="modal-backdrop"><form className="modal" onSubmit={deleteRun}><h2>Delete {mode} run?</h2><p>This permanently removes the selected run and its generated records. The deletion itself remains in the audit log.</p><label className="form-label">Enter your password to confirm<input autoComplete="current-password" className="field" type="password" required value={deletePassword} onChange={event=>setDeletePassword(event.target.value)}/></label><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setDeleteItem(null)}>Cancel</button><button className="btn danger" disabled={working||!deletePassword}>{working?"Deleting...":"Delete permanently"}</button></div></form></div>}
  </>;
}
