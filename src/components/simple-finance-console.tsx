"use client";import{appConfirm}from"@/lib/app-dialog";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { localDateKey } from "@/lib/dates";
import type {BillingPeriodOption} from "./billing-period-setup";
import {needsPurchaseOrder} from "@/lib/funded-days";
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
  const [periods,setPeriods]=useState<BillingPeriodOption[]>([]),[periodId,setPeriodId]=useState("");
  useEffect(()=>{if(mode!=="billing")return;const reload=()=>{fetch("/api/billing/periods",{cache:"no-store"}).then(r=>r.ok?r.json():[]).then(setPeriods);};reload();window.addEventListener("billing-periods-changed",reload);return()=>window.removeEventListener("billing-periods-changed",reload);},[mode]);
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
  useEffect(() => { if (mode !== "billing") return; fetch("/api/students/records?status=active", { cache: "no-store" }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to load clients."); setStudents(Array.isArray(body) ? body : []); }).catch(caught => setError(caught instanceof Error ? caught.message : "Unable to load clients.")); }, [mode]);
  const payers = [...new Set(students.map(student => student.billingProfile?.payerName).filter((value): value is string => Boolean(value)))].sort();
  const eligibleStudents = historicalMode ? students : students.filter(student => student.startDate.slice(0, 10) <= to && (!student.endDate || student.endDate.slice(0, 10) >= from));
  const chosenPeriod=periods.find(p=>p.id===periodId);
  const visibleStudents = eligibleStudents.filter(student => (!chosenPeriod||needsPurchaseOrder(student.billingProfile?.payerName||"")===(chosenPeriod.cycle==="LBE")) && (payerFilter === "ALL" || student.billingProfile?.payerName === payerFilter) && (!studentSearch.trim() || (student.displayName + " " + (student.internalReference || "")).toLowerCase().includes(studentSearch.trim().toLowerCase())));
  const hiddenSelectedCount = selectedStudentIds.filter(id => !visibleStudents.some(student => student.id === id)).length;
  useEffect(() => {
    const eligibleIds = new Set((historicalMode ? students : students.filter(student => student.startDate.slice(0, 10) <= to && (!student.endDate || student.endDate.slice(0, 10) >= from))).map(student => student.id));
    setSelectedStudentIds(current => { const next = current.filter(id => eligibleIds.has(id)); return next.length === current.length ? current : next; });
  }, [students, from, to, historicalMode]);

  async function prepare() {
    if (mode === "billing" && (!periodId || !runLabel.trim() || !selectedStudentIds.length)) { setError("Choose a saved billing period, enter a label and select at least one client."); return; }
    setWorking(true); setError("");
    try {
      const created = await fetch(endpoint, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ periodStart: from, periodEnd: to, billingPeriodId: periodId||undefined, requestKey: crypto.randomUUID(), ...(mode === "billing" ? { label: runLabel.trim(), studentIds: selectedStudentIds, historicalMode } : {}) }),
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
    if (!await appConfirm(mode === "billing" ? "Refresh this run from the latest agreed schedules?" : "Refresh this run from the latest attendance records?")) return;
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
  const visibleItems=mode === "billing"?items.filter(item=>item.status!=="INVOICES_GENERATED"):items;
  return <>
    <div className={styles.steps}>
      <div className={`card ${styles.step} ${styles.current}`}><b>1. Choose dates</b><span>{mode === "billing" ? "Agreed funded days are calculated automatically." : "Attendance is gathered automatically."}</span></div>
      <div className={`card ${styles.step}`}><b>2. Check warnings</b><span>Only missing or unusual information needs attention.</span></div>
      <div className={`card ${styles.step}`}><b>3. Approve and download</b><span>One final action creates the documents.</span></div>
    </div>
    {mode === "billing" && <div className={`alert alert-warning ${styles.help}`}>
      <b>What are payer and billing profiles?</b> The payer is the council, organisation, family member or other party receiving the invoice. A billing profile links that payer and the agreed rate to one service user. It is configured once per service user.
    </div>}
    {mode === "billing" && <section className="card" style={{padding:"18px",marginBottom:"16px"}}>
      <label className="form-label">Billing period<select className="field" value={periodId} onChange={e=>{setPeriodId(e.target.value);setSelectedStudentIds([]);const period=periods.find(p=>p.id===e.target.value);if(period){setFrom(period.periodStart.slice(0,10));setTo(period.periodEnd.slice(0,10));setRunLabel(period.label);}}}><option value="">Select a configured period</option>{periods.map(p=><option key={p.id} value={p.id}>{p.label} · {p.periodStart.slice(0,10)} – {p.periodEnd.slice(0,10)}</option>)}</select></label>
      {!periods.length&&<p>Use “Set up billing periods” above to add the LBE dates or full monthly periods.</p>}
      {chosenPeriod&&<p>{chosenPeriod.cycle==="LBE"?`Bank holidays deducted per client: ${chosenPeriod.bankHolidayDates.join(", ")||"None"}`:"Full calendar month. No automatic bank holiday deductions."}</p>}
      <div className="form-grid">
        <label className="form-label">Billing run label<input className="field" maxLength={191} placeholder="For example: LBE - 29 June to 26 July 2026" value={runLabel} onChange={event=>setRunLabel(event.target.value)}/></label>
        <label className="form-label">Payer filter<select className="field" value={payerFilter} onChange={event=>setPayerFilter(event.target.value)}><option value="ALL">All payers</option>{payers.map(payer=><option key={payer} value={payer}>{payer}</option>)}</select></label>
        <label className="form-label">Find a client<input className="field" placeholder="Name or client reference" value={studentSearch} onChange={event=>setStudentSearch(event.target.value)}/></label>
        <label className="form-label" style={{alignSelf:"end"}}><span><input type="checkbox" checked={historicalMode} onChange={event=>setHistoricalMode(event.target.checked)}/> Historical funded period (confirm dated funding agreements)</span></label>
      </div>
      <div className="table-actions" style={{margin:"12px 0"}}><button type="button" className="btn secondary" onClick={()=>setSelectedStudentIds(visibleStudents.map(student=>student.id))}>Select shown only</button><button type="button" className="btn secondary" onClick={()=>setSelectedStudentIds([])}>Clear all</button><span className="muted">{selectedStudentIds.length} client{selectedStudentIds.length===1?"":"s"} selected{hiddenSelectedCount>0?` (${hiddenSelectedCount} hidden by the current filter)`:""}</span></div>
      <div style={{maxHeight:"260px",overflow:"auto",border:"1px solid var(--border)",borderRadius:"12px",padding:"8px"}}>{visibleStudents.length?visibleStudents.map(student=><label key={student.id} style={{display:"flex",gap:"10px",alignItems:"center",padding:"9px"}}><input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={event=>setSelectedStudentIds(event.target.checked?[...selectedStudentIds,student.id]:selectedStudentIds.filter(id=>id!==student.id))}/><span><b>{student.displayName}</b>{student.internalReference&&<small className="muted" style={{display:"block"}}>{student.internalReference}</small>}</span><span className="muted" style={{marginLeft:"auto"}}>{student.billingProfile?.payerName||"Billing not configured"}</span></label>):<div className="empty">No clients match this filter.</div>}</div>
    </section>}
    <div className="toolbar">
      <label>From<input autoComplete="off" className="field" type="date" readOnly={mode==="billing"} value={from} onChange={event => setFrom(event.target.value)}/></label>
      <label>To<input autoComplete="off" className="field" type="date" readOnly={mode==="billing"} value={to} onChange={event => setTo(event.target.value)}/></label>
      <button className="btn primary" disabled={working || !from || !to || (mode === "billing" && (!periodId || !runLabel.trim() || !selectedStudentIds.length))} onClick={prepare}>{working ? "Preparing..." : `Prepare ${mode}`}</button>
      {mode === "billing" && <a className="btn secondary" href="/dashboard/billing/profiles">Manage billing setup</a>}
    </div>
    {error && <div className="alert alert-error">{error}</div>}
    <details open><summary>{mode === "billing" ? "Open billing runs — completed invoices are in the archive below" : "Payroll runs"}</summary><section className="card table-wrap">
      {loading ? <div className="empty">Loading...</div> : visibleItems.length ? <table className="table">
        <thead><tr><th>Period</th><th>Status</th><th>Records</th><th>Next action</th></tr></thead>
        <tbody>{visibleItems.map(item => <tr key={item.id}>
          <td>{mode === "billing" && item.label && <b style={{display:"block"}}>{item.label}</b>}{new Date(item.periodStart).toLocaleDateString("en-GB")} to {new Date(item.periodEnd).toLocaleDateString("en-GB")}</td>
          <td><span className="status-pill">{label(item.status)}</span></td>
          <td>{item._count?.entries ?? item._count?.charges ?? 0}</td>
          <td><div className="table-actions">
            <a className="btn primary" href={`/dashboard/${mode}/runs/${item.id}`}>{["EXPORTED", "INVOICES_GENERATED"].includes(item.status) ? "View completed run" : "Continue"}</a>
            {["DRAFT", "REQUIRES_REVIEW", "REVIEWED"].includes(item.status) && <button className="btn secondary" disabled={working} onClick={() => refresh(item)}>Refresh calculations</button>}<button className="btn danger" onClick={()=>{setDeleteItem(item);setDeletePassword("");setError("")}} disabled={working || (mode === "billing" && item.status === "INVOICES_GENERATED")}>Delete run</button>
          </div></td>
        </tr>)}</tbody>
      </table> : <div className="empty"><b>No {mode} runs yet</b><p>Choose dates above to prepare the first one.</p></div>}
    </section></details>
    {deleteItem&&<div className="modal-backdrop"><form className="modal" onSubmit={deleteRun}><h2>Delete {mode} run?</h2><p>This permanently removes the selected run and its generated records. The deletion itself remains in the audit log.</p><label className="form-label">Enter your password to confirm<input autoComplete="current-password" className="field" type="password" required value={deletePassword} onChange={event=>setDeletePassword(event.target.value)}/></label><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setDeleteItem(null)}>Cancel</button><button className="btn danger" disabled={working||!deletePassword}>{working?"Deleting...":"Delete permanently"}</button></div></form></div>}
  </>;
}
