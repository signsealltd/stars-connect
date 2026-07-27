"use client";import{appConfirm,appPrompt}from"@/lib/app-dialog";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./finance-workflow.module.css";

type Entry = {
  id: string; staffId: string; staffName: string; payrollNumber?: string; ordinaryMinutes: number; overtimeMinutes: number;
  adjustmentMinutes: number; totalPayableMinutes: number; exceptionCount: number; exceptionStatus: string;
  sourceSnapshot: { exceptions?: string[] };
};
type Charge = {
  id: string; studentId: string; studentName: string; payerName: string; description: string; netAmount: string | number;
  vatAmount: string | number; grossAmount: string | number; exceptionCode?: string; excluded: boolean;
};
type Run = {
  id: string; status: string; version: number; periodStart: string; periodEnd: string; updatedAt: string;
  entries?: Entry[]; charges?: Charge[];
  invoices?: Array<{ id: string; invoiceNumber: string; documentId?: string; grossTotal: string | number }>;
};

const hours = (minutes: number) => `${(minutes / 60).toFixed(2)}h`;
const money = (value: string | number) => `Â£${Number(value).toFixed(2)}`;

export function SimpleFinanceRunReview({ mode, id }: { mode: "payroll" | "billing"; id: string }) {
  const endpoint = mode === "payroll" ? `/api/payroll/periods/${id}` : `/api/billing/runs/${id}`;
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setRun(body); else setError(body.error || "Unable to load this run.");
    setLoading(false);
  }, [endpoint]);
  useEffect(() => { load(); }, [load]);

  const records = useMemo(() => mode === "payroll" ? run?.entries || [] : run?.charges || [], [mode, run]);
  const exceptions = mode === "payroll"
    ? (run?.entries || []).filter(entry => entry.exceptionCount > 0 && !["RESOLVED", "EXCLUDED"].includes(entry.exceptionStatus))
    : (run?.charges || []).filter(charge => charge.exceptionCode && !charge.excluded);
  const excluded = mode === "payroll"
    ? (run?.entries || []).filter(entry => entry.exceptionStatus === "EXCLUDED").length
    : (run?.charges || []).filter(charge => charge.excluded).length;
  const visible = records.filter(record => {
    if (filter === "ALL") return true;
    if (mode === "payroll") {
      const entry = record as Entry;
      return filter === "WARNINGS" ? entry.exceptionCount > 0 : entry.exceptionStatus === "EXCLUDED";
    }
    const charge = record as Charge;
    return filter === "WARNINGS" ? Boolean(charge.exceptionCode) : charge.excluded;
  });

  async function action(name: string, extra: Record<string, unknown> = {}, reload = true) {
    const response = await fetch(endpoint, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: name, ...(name === "approve" ? { updatedAt: run?.updatedAt } : {}), ...extra }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `${name} failed.`);
    if (reload) await load();
    return body;
  }

  async function resolve(record: Entry | Charge) {
    const reason = await appPrompt("Briefly explain how this warning was checked or corrected:");
    if (!reason || reason.trim().length < 5) return;
    setWorking(true); setError("");
    try {
      if (mode === "payroll") await action("review-entry", { entryId: record.id, resolved: true, reason });
      else await action("resolve-charge", { chargeId: record.id, reason });
      setSuccess("Warning resolved.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to resolve warning."); }
    finally { setWorking(false); }
  }

  async function exclude(record: Entry | Charge, isExcluded: boolean) {
    const reason = await appPrompt(`Reason for ${isExcluded ? "restoring" : "excluding"} this record:`);
    if (!reason || reason.trim().length < 5) return;
    setWorking(true); setError("");
    try {
      await action(isExcluded ? (mode === "payroll" ? "restore-entry" : "restore-charge") : (mode === "payroll" ? "exclude-entry" : "exclude-charge"), {
        [mode === "payroll" ? "entryId" : "chargeId"]: record.id, reason,
      });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to change the record."); }
    finally { setWorking(false); }
  }

  async function refreshCalculations() {
    if (!await appConfirm("Refresh this run from the latest attendance records?")) return;
    setWorking(true); setError("");
    try { await action("calculate"); setSuccess("Calculations refreshed."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to refresh calculations."); }
    finally { setWorking(false); }
  }

  async function approveAndCreate() {
    if (!run || exceptions.length || !records.length) return;
    if (!await appConfirm(`Approve the totals shown and create the final ${mode === "payroll" ? "payroll files" : "invoices"}?`)) return;
    setWorking(true); setError("");
    try {
      let status = run.status;
      if (mode === "payroll" && ["REQUIRES_REVIEW", "REVIEWED"].includes(status)) {
        for (const entry of run.entries || []) {
          if (entry.exceptionStatus !== "EXCLUDED" && !entry.exceptionCount) {
            await action("review-entry", { entryId: entry.id, resolved: false }, false);
          }
        }
      }
      if (["REQUIRES_REVIEW", "REVIEWED"].includes(status)) { await action("approve", {}, false); status = "APPROVED"; }
      if (status === "APPROVED") { await action("lock", {}, false); status = "LOCKED"; }
      if (mode === "payroll" && status === "LOCKED") {
        const response = await fetch(`/api/payroll/periods/${id}/documents`, { method: "POST" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to create payroll files.");
        window.location.assign(`/api/documents/${body.zipDocument.id}/download`);
        return;
      }
      if (mode === "billing" && status === "LOCKED") {
        await action("generate-invoices", {}, false);
        const response = await fetch(`/api/billing/runs/${id}/documents`, { method: "POST" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to create invoice files.");
        window.location.assign(`/api/documents/${body.zipDocument.id}/download`);
        return;
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to finalise ${mode}.`);
      await load();
    } finally { setWorking(false); }
  }

  if (loading) return <div className="empty">Loading calculated recordsâ€¦</div>;
  if (!run) return <div className="alert alert-error">{error || "Run not found."}</div>;
  const complete = ["EXPORTED", "INVOICES_GENERATED"].includes(run.status);
  const gross = mode === "billing" ? (run.charges || []).filter(charge => !charge.excluded).reduce((sum, charge) => sum + Number(charge.grossAmount), 0) : 0;
  const payable = mode === "payroll" ? (run.entries || []).filter(entry => entry.exceptionStatus !== "EXCLUDED").reduce((sum, entry) => sum + entry.totalPayableMinutes, 0) : 0;

  return <>
    <div className="page-head"><div><h1 className="page-title">{mode === "payroll" ? "Payroll" : "Billing"} review</h1>
      <p className="muted">{new Date(run.periodStart).toLocaleDateString("en-GB")} â€“ {new Date(run.periodEnd).toLocaleDateString("en-GB")}</p></div>
      <span className="status-pill">{complete ? "COMPLETE" : exceptions.length ? "ACTION NEEDED" : "READY"}</span>
    </div>
    <div className={styles.steps}>
      <div className={`card ${styles.step} ${styles.done}`}><b>1. Attendance gathered</b><span>{records.length} record{records.length === 1 ? "" : "s"} calculated.</span></div>
      <div className={`card ${styles.step} ${exceptions.length ? styles.current : styles.done}`}><b>2. Check warnings</b><span>{exceptions.length ? `${exceptions.length} need attention.` : "Nothing outstanding."}</span></div>
      <div className={`card ${styles.step} ${!exceptions.length && !complete ? styles.current : complete ? styles.done : ""}`}><b>3. Approve and download</b><span>{complete ? "Completed." : "One final confirmation."}</span></div>
    </div>
    {error && <div className="alert alert-error">{error}</div>}
    {success && <div className="alert alert-success">{success}</div>}
    {mode === "billing" && (run.charges || []).some(charge => charge.exceptionCode === "MISSING_BILLING_PROFILE") && <div className={`card ${styles.callout}`}>
      <div><b>Some service users have no billing setup</b><p>A billing profile records who receives their invoice and the agreed day rate. Select â€œSet up billingâ€ beside each affected person, then refresh calculations.</p></div>
      <a className="btn secondary" href="/dashboard/billing/profiles">View all billing profiles</a>
    </div>}
    <div className={styles.summary}>
      <div className="card"><b>{records.length}</b><span>Records</span></div>
      <div className="card"><b>{exceptions.length}</b><span>Warnings</span></div>
      <div className="card"><b>{excluded}</b><span>Excluded</span></div>
      <div className="card"><b>{mode === "payroll" ? hours(payable) : money(gross)}</b><span>{mode === "payroll" ? "Total payable" : "Invoice total"}</span></div>
    </div>
    <div className={styles.actions}>
      <select className="field" value={filter} onChange={event => setFilter(event.target.value)}><option value="ALL">All records</option><option value="WARNINGS">Warnings only</option><option value="EXCLUDED">Excluded</option></select>
      {!complete && <button className="btn primary" disabled={working || exceptions.length > 0 || records.length === 0} onClick={approveAndCreate}>{working ? "Workingâ€¦" : `Approve and create ${mode === "payroll" ? "payroll files" : "invoices"}`}</button>}
      {!complete && <button className="btn secondary" disabled={working} onClick={refreshCalculations}>Refresh calculations</button>}
      {mode === "billing" && complete && <button className="btn primary" onClick={async () => {
        const response = await fetch(`/api/billing/runs/${id}/documents`, { method: "POST" }); const body = await response.json();
        if (response.ok) window.location.assign(`/api/documents/${body.zipDocument.id}/download`); else setError(body.error || "Unable to download invoices.");
      }}>Download invoices</button>}
      {mode === "payroll" && complete && <a className="btn primary" href="/dashboard/reports/payroll">Download payroll files</a>}
    </div>
    <section className="card table-wrap"><table className="table">
      <thead><tr><th>{mode === "payroll" ? "Employee" : "Service user"}</th><th>{mode === "payroll" ? "Payroll number" : "Payer"}</th><th>{mode === "payroll" ? "Regular" : "Description"}</th><th>{mode === "payroll" ? "Overtime" : "Net"}</th><th>{mode === "payroll" ? "Adjustments" : "VAT"}</th><th>{mode === "payroll" ? "Payable" : "Total"}</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{visible.map(record => mode === "payroll" ? (() => {
        const entry = record as Entry; const isExcluded = entry.exceptionStatus === "EXCLUDED";
        return <tr key={entry.id}><td>{entry.staffName}</td><td>{entry.payrollNumber || "Not configured"}</td><td>{hours(entry.ordinaryMinutes)}</td><td>{hours(entry.overtimeMinutes)}</td><td>{hours(entry.adjustmentMinutes)}</td><td>{hours(entry.totalPayableMinutes)}</td><td>{entry.exceptionCount ? (isExcluded ? "EXCLUDED" : entry.exceptionStatus) : "CLEAR"}</td><td><div className="table-actions">{entry.exceptionCount > 0 && !isExcluded && <button className="btn primary" disabled={working} onClick={() => resolve(entry)}>Resolve warning</button>}<button className="btn secondary" disabled={working} onClick={() => exclude(entry, isExcluded)}>{isExcluded ? "Restore" : "Exclude"}</button></div></td></tr>;
      })() : (() => {
        const charge = record as Charge; const missing = charge.exceptionCode === "MISSING_BILLING_PROFILE";
        return <tr key={charge.id}><td>{charge.studentName}</td><td>{missing ? "Not set up" : charge.payerName}</td><td>{missing ? "Billing details required" : charge.description}</td><td>{money(charge.netAmount)}</td><td>{money(charge.vatAmount)}</td><td>{money(charge.grossAmount)}</td><td>{charge.excluded ? "EXCLUDED" : missing ? "SETUP REQUIRED" : charge.exceptionCode || "CLEAR"}</td><td><div className="table-actions">{missing ? <a className="btn primary" href={`/dashboard/billing/profiles?studentId=${charge.studentId}&returnTo=${encodeURIComponent(`/dashboard/billing/runs/${id}`)}`}>Set up billing</a> : charge.exceptionCode && <button className="btn primary" disabled={working} onClick={() => resolve(charge)}>Resolve warning</button>}<button className="btn secondary" disabled={working} onClick={() => exclude(charge, charge.excluded)}>{charge.excluded ? "Restore" : "Exclude"}</button></div></td></tr>;
      })())}</tbody>
    </table>{!visible.length && <div className="empty">No records match this filter.</div>}</section>
    {(run.invoices || []).length > 0 && <section className="card"><h2>Generated invoices</h2>{run.invoices!.map(invoice => <p key={invoice.id}>{invoice.invoiceNumber} Â· {money(invoice.grossTotal)} {invoice.documentId && <a className="btn secondary" href={`/api/documents/${invoice.documentId}/download`}>Download</a>}</p>)}</section>}
  </>;
}


