"use client";import{appConfirm,appReasonPrompt}from"@/lib/app-dialog";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bus } from "lucide-react";
import styles from "./finance-workflow.module.css";
import { defaultPayrollReason, payrollAdjustmentForReason, payrollAdjustmentOptions } from "@/lib/payroll-adjustment-options";
import { financeCorrectionReasons, resolvedReason } from "@/lib/operational-reasons";

type Entry = {
  id: string; staffId: string; staffName: string; payrollNumber?: string; hourlyRate?: string | number; overtimeHourlyRate?: string | number; grossPay?: string | number; ordinaryMinutes: number; overtimeMinutes: number;
  adjustmentMinutes: number; holidayMinutes: number; sicknessMinutes: number; trainingMinutes: number; unpaidMinutes: number; originalMinutes: number; transportMinutes: number; preRoundedMinutes: number; roundingMinutes: number; totalPayableMinutes: number; exceptionCount: number; exceptionStatus: string;
  sourceSnapshot: { exceptions?: string[] };
};
type Charge = {
  id: string; billingProfileId: string; studentId: string; studentName: string; payerName: string; description: string;
  quantity: string | number; unitRate: string | number; netAmount: string | number; vatRate: string | number;
  vatAmount: string | number; grossAmount: string | number; exceptionCode?: string; excluded: boolean;
  manuallyAdjusted?: boolean; adjustmentReason?: string;
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
  const [payItemEntry, setPayItemEntry] = useState<Entry | null>(null);
  const [payItem, setPayItem] = useState({ category: "HOLIDAY", date: "", hours: "8", reason: "APPROVED_ANNUAL_LEAVE" });
  const [billingAdjustment, setBillingAdjustment] = useState<Charge | null>(null);
  const [billingTotal, setBillingTotal] = useState("");
  const [billingReason, setBillingReason] = useState("");
  const [billingOtherReason, setBillingOtherReason] = useState("");
  const [billingDescription, setBillingDescription] = useState("Day trip");
  const [billingQuantity, setBillingQuantity] = useState("1");
  const [billingDate, setBillingDate] = useState("");

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
    const reason = await appReasonPrompt("How was this warning checked or corrected?", financeCorrectionReasons);
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
    const reason = await appReasonPrompt(`Why are you ${isExcluded ? "restoring" : "excluding"} this record?`, financeCorrectionReasons);
    if (!reason || reason.trim().length < 5) return;
    setWorking(true); setError("");
    try {
      await action(isExcluded ? (mode === "payroll" ? "restore-entry" : "restore-charge") : (mode === "payroll" ? "exclude-entry" : "exclude-charge"), {
        [mode === "payroll" ? "entryId" : "chargeId"]: record.id, reason,
      });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to change the record."); }
    finally { setWorking(false); }
  }

  function openPayItem(entry: Entry) {
    setError("");
    setPayItem({ category: "HOLIDAY", date: run?.periodStart.slice(0, 10) || "", hours: "8", reason: "APPROVED_ANNUAL_LEAVE" });
    setPayItemEntry(entry);
  }

  async function addPayItem(event: React.FormEvent) {
    event.preventDefault();
    if (!payItemEntry) return;
    const itemHours = Number(payItem.hours);
    if (!Number.isFinite(itemHours) || itemHours <= 0 || itemHours > 24) { setError("Enter hours greater than 0 and no more than 24."); return; }
    const selected = payrollAdjustmentForReason(payItem.reason);
    if (!selected || selected.category !== payItem.category) { setError("The selected pay item type and reason do not match."); return; }
    setWorking(true); setError(""); setSuccess("");
    try {
      await action("add-adjustment", { staffId: payItemEntry.staffId, date: payItem.date, category: selected.category, minutes: Math.round(itemHours * 60), paid: selected.paid, reasonCode: selected.code, reason: selected.label }, false);
      await action("calculate");
      setSuccess(`${payItem.category.charAt(0)}${payItem.category.slice(1).toLowerCase()} recorded and payroll recalculated.`);
      setPayItemEntry(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add the pay item."); }
    finally { setWorking(false); }
  }

  async function refreshCalculations() {
    if (!await appConfirm("Refresh this run from the latest attendance records?")) return;
    setWorking(true); setError("");
    try { await action("calculate"); setSuccess("Calculations refreshed."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to refresh calculations."); }
    finally { setWorking(false); }
  }

function openBillingAdjustment(charge: Charge) {
    setError("");
    setBillingDescription("Day trip");
    setBillingQuantity("1");
    setBillingTotal("");
    setBillingDate(run?.periodStart.slice(0, 10) || "");
    setBillingReason("");
    setBillingOtherReason("");
    setBillingAdjustment(charge);
  }

  async function saveBillingAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!billingAdjustment) return;
    const quantity = Number(billingQuantity), unitRate = Number(billingTotal);
    if (!billingDescription.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitRate) || unitRate < 0) {
      setError("Enter a service description, quantity and unit price."); return;
    }
    const reason = resolvedReason(financeCorrectionReasons, billingReason, billingOtherReason);
    if (reason.length < 5) { setError("Choose a reason. If you select Other, enter at least five characters."); return; }
    setWorking(true); setError(""); setSuccess("");
    try {
      await action("manual-charge", { billingProfileId: billingAdjustment.billingProfileId, studentId: billingAdjustment.studentId, sourceDate: billingDate, description: billingDescription.trim(), quantity, unitRate, reason });
      setSuccess(`${billingDescription.trim()} added. Invoice totals were recalculated automatically.`);
      setBillingAdjustment(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add the invoice service."); }
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

  if (loading) return <div className="empty">Loading calculated recordsÃ¢â‚¬Â¦</div>;
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
      <div><b>Some service users have no billing setup</b><p>A billing profile records who receives their invoice and the agreed day rate. Select Ã¢â‚¬Å“Set up billingÃ¢â‚¬Â beside each affected person, then refresh calculations.</p></div>
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
      {!complete && <button className="btn primary" disabled={working || exceptions.length > 0 || records.length === 0} onClick={approveAndCreate}>{working ? "WorkingÃ¢â‚¬Â¦" : `Approve and create ${mode === "payroll" ? "payroll files" : "invoices"}`}</button>}
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
        return <tr key={entry.id}><td><button className="btn ghost" disabled={working || complete || isExcluded} onClick={() => openPayItem(entry)}>{entry.staffName}</button></td><td>{entry.payrollNumber || "Not configured"}</td><td>{hours(entry.ordinaryMinutes)}</td><td>{hours(entry.overtimeMinutes)}<small style={{display:"block"}}>{entry.overtimeHourlyRate != null || entry.hourlyRate != null ? `@ GBP ${Number(entry.overtimeHourlyRate ?? entry.hourlyRate).toFixed(2)}/hour` : "Rate not configured"}</small></td><td>{hours(entry.adjustmentMinutes)}<small style={{display:"block"}}>Holiday {hours(entry.holidayMinutes)} | Sickness {hours(entry.sicknessMinutes)} | Training {hours(entry.trainingMinutes)} | Unpaid {hours(entry.unpaidMinutes)}<br/>Original {hours(entry.originalMinutes)} | {entry.transportMinutes>0&&<><Bus size={15} style={{verticalAlign:"middle"}}/> +{(entry.transportMinutes/60).toFixed(2)} Hours | </>}Before rounding {hours(entry.preRoundedMinutes)} | Rounding {entry.roundingMinutes>=0?"+":""}{hours(entry.roundingMinutes)}</small></td><td>{hours(entry.totalPayableMinutes)}</td><td>{entry.exceptionCount ? (isExcluded ? "EXCLUDED" : entry.exceptionStatus) : "CLEAR"}</td><td><div className="table-actions">{!complete && !isExcluded && <button className="btn secondary" disabled={working} onClick={() => openPayItem(entry)}>Add pay item</button>}{entry.exceptionCount > 0 && !isExcluded && <button className="btn primary" disabled={working} onClick={() => resolve(entry)}>Resolve warning</button>}<button className="btn secondary" disabled={working || complete} onClick={() => exclude(entry, isExcluded)}>{isExcluded ? "Restore" : "Exclude"}</button></div></td></tr>;
      })() : (() => {
        const charge = record as Charge; const missing = charge.exceptionCode === "MISSING_BILLING_PROFILE";
        return <tr key={charge.id}><td>{charge.studentName}</td><td>{missing ? "Not set up" : charge.payerName}</td><td>{missing ? "Billing details required" : <>{charge.description}{charge.manuallyAdjusted && <small className="muted" style={{display:"block"}}>Adjusted with reason recorded</small>}</>}</td><td>{money(charge.netAmount)}</td><td>{money(charge.vatAmount)}</td><td><b>{money(charge.grossAmount)}</b></td><td>{charge.excluded ? "EXCLUDED" : missing ? "SETUP REQUIRED" : charge.exceptionCode || (charge.manuallyAdjusted ? "ADJUSTED" : "CLEAR")}</td><td><div className="table-actions">{missing ? <a className="btn primary" href={`/dashboard/billing/profiles?studentId=${charge.studentId}&returnTo=${encodeURIComponent(`/dashboard/billing/runs/${id}`)}`}>Set up billing</a> : <button className="btn primary" disabled={working || complete || charge.excluded} onClick={() => openBillingAdjustment(charge)}>Add service</button>}<button className="btn secondary" disabled={working || complete} onClick={() => exclude(charge, charge.excluded)}>{charge.excluded ? "Restore" : "Exclude"}</button></div></td></tr>;
      })())}</tbody>
    </table>{!visible.length && <div className="empty">No records match this filter.</div>}</section>
    {(run.invoices || []).length > 0 && <section className="card"><h2>Generated invoices</h2>{run.invoices!.map(invoice => <p key={invoice.id}>{invoice.invoiceNumber} Ã‚Â· {money(invoice.grossTotal)} {invoice.documentId && <a className="btn secondary" href={`/api/documents/${invoice.documentId}/download`}>Download</a>}</p>)}</section>}
    {payItemEntry && <div className="modal-backdrop"><form className="modal" onSubmit={addPayItem}>
      <h2>Add pay item for {payItemEntry.staffName}</h2>
      <div className="form-grid">
        <label className="form-label">Pay item type<select className="field" value={payItem.category} onChange={event => { const option=defaultPayrollReason(event.target.value); setPayItem({...payItem,category:option.category,reason:option.code}); }}><option value="HOLIDAY">Holiday</option><option value="SICKNESS">Sickness</option><option value="OVERTIME">Overtime</option><option value="TRAINING">Training</option><option value="UNPAID">Unpaid leave</option><option value="OTHER">Other</option></select></label>
        <label className="form-label">Reason<select className="field" value={payItem.reason} onChange={event => { const option=payrollAdjustmentForReason(event.target.value); if(option)setPayItem({...payItem,reason:option.code,category:option.category}); }}>{payrollAdjustmentOptions.map(option=><option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
        <label className="form-label">Date<input className="field" type="date" required value={payItem.date} onChange={event => setPayItem({...payItem, date:event.target.value})}/></label>
        <label className="form-label">Hours<input className="field" type="number" min="0.25" max="24" step="0.25" required value={payItem.hours} onChange={event => setPayItem({...payItem, hours:event.target.value})}/></label>
      </div>
      <div className="modal-actions"><button type="button" className="btn secondary" disabled={working} onClick={() => setPayItemEntry(null)}>Cancel</button><button className="btn primary" disabled={working}>{working?"Savingâ€¦":"Add and recalculate"}</button></div>
    </form></div>}
    {billingAdjustment && <div className="modal-backdrop"><form className="modal" onSubmit={saveBillingAdjustment}>
      <h2>Add an invoice service</h2>
      <p><b>{billingAdjustment.studentName}</b> · {billingAdjustment.payerName}</p>
      <div className="form-grid">
        <label className="form-label">Service description<input className="field" maxLength={191} required value={billingDescription} onChange={event=>setBillingDescription(event.target.value)}/></label>
        <label className="form-label">Service date<input className="field" type="date" required value={billingDate} onChange={event=>setBillingDate(event.target.value)}/></label>
        <label className="form-label">Quantity<input className="field" type="number" min="0.001" max="1000" step="0.001" required value={billingQuantity} onChange={event=>setBillingQuantity(event.target.value)}/></label>
        <label className="form-label">Unit price (£)<input className="field" type="number" min="0" step="0.01" required value={billingTotal} onChange={event=>setBillingTotal(event.target.value)}/></label>
      </div>
      <div className="card" style={{padding:"14px",marginBottom:"16px"}}><span className="muted">Line total</span><b style={{display:"block",fontSize:"24px"}}>{money((Number(billingQuantity)||0)*(Number(billingTotal)||0))}</b><small className="muted">VAT is calculated automatically from the saved billing profile.</small></div>
      <label className="form-label">Reason for adding service<select className="field" required value={billingReason} onChange={event=>setBillingReason(event.target.value)}><option value="">Choose a reason</option>{financeCorrectionReasons.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{billingReason==="OTHER"&&<label className="form-label">Other reason<textarea className="field" minLength={5} maxLength={1000} required value={billingOtherReason} onChange={event=>setBillingOtherReason(event.target.value)}/></label>}
      <div className="modal-actions"><button type="button" className="btn secondary" disabled={working} onClick={()=>setBillingAdjustment(null)}>Cancel</button><button className="btn primary" disabled={working}>{working?"Adding…":"Add service and recalculate"}</button></div>
    </form></div>}  </>;
}


