"use client";import{appConfirm,appPrompt,appReasonPrompt}from"@/lib/app-dialog";

import { financeCorrectionReasons } from "@/lib/operational-reasons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { workflowActions } from "@/lib/finance-workflow";

type Entry = {
  id: string;
  staffId: string;
  staffName: string;
  payrollNumber?: string;
  ordinaryMinutes: number;
  overtimeMinutes: number;
  hourlyRate?: string | number;
  overtimeHourlyRate?: string | number;
  grossPay?: string | number;
  holidayMinutes: number;
  sicknessMinutes: number;
  trainingMinutes: number;
  unpaidMinutes: number;
  adjustmentMinutes: number;
  totalPayableMinutes: number;
  exceptionCount: number;
  exceptionStatus: string;
  reviewedAt?: string;
  sourceSnapshot: { events?: Array<{ id: string; type: string; at: string; offline?: boolean }>; exceptions?: string[] };
};
type Charge = {
  id: string;
  studentName: string;
  payerName: string;
  sourceDate: string;
  sourceAttendanceId?: string;
  description: string;
  quantity: string | number;
  unitRate: string | number;
  netAmount: string | number;
  vatAmount: string | number;
  grossAmount: string | number;
  exceptionCode?: string;
  excluded: boolean;
  manuallyAdjusted: boolean;
  adjustmentReason?: string;
};
type Run = {
  id: string;
  status: string;
  version: number;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
  entries?: Entry[];
  charges?: Charge[];
  adjustments?: Array<{ id: string; staffId: string; date: string; category: string; minutes: number; paid: boolean; reason: string; createdAt: string }>;
  invoices?: Array<{ id: string; invoiceNumber: string; documentId?: string; grossTotal: string | number }>;
  auditHistory?: Array<{ id: string; action: string; actorId?: string; createdAt: string; afterValue?: unknown }>;
};

const hours = (minutes: number) => `${(minutes / 60).toFixed(2)}h`;
const money = (value: string | number) => `£${Number(value).toFixed(2)}`;

export function FinanceRunReview({ mode, id }: { mode: "payroll" | "billing"; id: string }) {
  const endpoint = mode === "payroll" ? `/api/payroll/periods/${id}` : `/api/billing/runs/${id}`;
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setRun(body);
    else setError(body.error || "Unable to load the run.");
    setLoading(false);
  }, [endpoint]);
  useEffect(() => { load(); }, [load]);

  const records = useMemo(() => mode === "payroll" ? run?.entries || [] : run?.charges || [], [mode, run]);
  const visible = records.filter((record) => {
    if (filter === "ALL") return true;
    if (mode === "payroll") {
      const entry = record as Entry;
      if (filter === "EXCEPTIONS") return entry.exceptionCount > 0;
      if (filter === "UNREVIEWED") return !entry.reviewedAt && entry.exceptionStatus !== "EXCLUDED";
      return entry.exceptionStatus === "EXCLUDED";
    }
    const charge = record as Charge;
    if (filter === "EXCEPTIONS") return !!charge.exceptionCode;
    if (filter === "ADJUSTED") return charge.manuallyAdjusted;
    return charge.excluded;
  });
  const rules = workflowActions(run?.status || "DRAFT", records.length);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setError(""); setSuccess("");
    const response = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, updatedAt: run?.updatedAt, ...extra }) });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "Action failed.");
    setSuccess(`${action.replaceAll("-", " ")} completed.`);
    await load();
    return body;
  }
  async function reasoned(action: string, recordId: string) {
    const reason = await appReasonPrompt("Choose the internal reason for this action.", financeCorrectionReasons);
    if (!reason) return;
    await act(action, { [mode === "payroll" ? "entryId" : "chargeId"]: recordId, reason });
  }
  async function transition(action: "approve" | "lock") {
    const included = mode === "payroll" ? payroll.filter(e=>e.exceptionStatus!=="EXCLUDED").length : charges.filter(c=>!c.excluded).length;
    const total = mode === "payroll" ? hours(payroll.filter(e=>e.exceptionStatus!=="EXCLUDED").reduce((n,e)=>n+e.totalPayableMinutes,0)) : money(charges.filter(c=>!c.excluded).reduce((n,c)=>n+Number(c.grossAmount),0));
    const label = action === "approve" ? `approve ${included} included records (${excludedCount} excluded), total ${total}, with ${exceptionCount} recorded exceptions` : "lock this approved run permanently";
    if (!await appConfirm(`Confirm you want to ${label}?`)) return;
    await act(action);
  }
  async function generate() {
    if (!await appConfirm(`Generate ${mode === "payroll" ? "the locked payroll export" : "invoices from the locked reviewed charges"}?`)) return;
    if (mode === "payroll") {
      const response = await fetch(`/api/payroll/periods/${id}/documents`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) return setError(body.error || "Unable to generate the payroll package.");
      setSuccess("Payroll CSV and employee timesheet package generated.");
      await load();
      window.location.assign(`/api/documents/${body.zipDocument.id}/download`);
      return;
    }
    const body = await act("generate-invoices");
    if (body?.id && body.mimeType) window.location.assign(`/api/documents/${body.id}/download`);
  }
  async function downloadBundle() {
    const response = await fetch(`/api/billing/runs/${id}/documents`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "Unable to generate invoice package.");
    window.location.assign(`/api/documents/${body.zipDocument.id}/download`);
  }  async function bulkReview() {
    if (mode !== "payroll") return;
    const clean = (run?.entries || []).filter((entry) => selected.includes(entry.id) && entry.exceptionCount === 0);
    for (const entry of clean) await act("review-entry", { entryId: entry.id });
    setSelected([]);
  }
  async function addAdjustment(entry: Entry) {
    const minutes = Number(await appPrompt("Adjustment minutes (negative values reduce payable time):"));
    if (!Number.isFinite(minutes)) return;
    const category = await appPrompt("Category: HOLIDAY, SICKNESS, TRAINING or MANUAL", "MANUAL");
    const date = await appPrompt("Attendance date (YYYY-MM-DD)", run?.periodStart.slice(0, 10));
    const reason = await appReasonPrompt("Choose the reason for this payroll adjustment.", financeCorrectionReasons);
    if (!category || !date || !reason) return;
    await act("add-adjustment", { staffId: entry.staffId, date, category, minutes, paid: true, reason });
    setSuccess("Adjustment recorded. Recalculate the run to apply it.");
  }

  if (loading) return <div className="empty">Loading calculated records…</div>;
  if (!run) return <div className="alert alert-error">{error || "Run not found."}</div>;

  const payroll = run.entries || [];
  const charges = run.charges || [];
  const exceptionCount = mode === "payroll" ? payroll.reduce((n, e) => n + e.exceptionCount, 0) : charges.filter(c => c.exceptionCode).length;
  const reviewedCount = mode === "payroll" ? payroll.filter(e => e.reviewedAt).length : charges.filter(c => !c.exceptionCode).length;
  const excludedCount = mode === "payroll" ? payroll.filter(e => e.exceptionStatus === "EXCLUDED").length : charges.filter(c => c.excluded).length;

  return <>
    <div className="page-head"><div><h1 className="page-title">{mode === "payroll" ? "Payroll" : "Billing"} run review</h1><p className="muted">{new Date(run.periodStart).toLocaleDateString("en-GB")} – {new Date(run.periodEnd).toLocaleDateString("en-GB")} · Version {run.version}</p></div><span className="status-pill">{run.status.replaceAll("_", " ")}</span></div>
    {error && <div className="alert alert-error">{error}</div>}{success && <div className="alert alert-success">{success}</div>}
    <div className="tiles">
      <div className="card"><b>{records.length}</b><span>Records</span></div>
      <div className="card"><b>{exceptionCount}</b><span>Exceptions</span></div>
      <div className="card"><b>{reviewedCount}</b><span>Reviewed / clear</span></div>
      <div className="card"><b>{excludedCount}</b><span>Excluded</span></div>
      {mode === "payroll" && <><div className="card"><b>{hours(payroll.reduce((n,e)=>n+e.ordinaryMinutes,0))}</b><span>Regular hours</span></div><div className="card"><b>{hours(payroll.reduce((n,e)=>n+e.overtimeMinutes,0))}</b><span>Overtime</span></div><div className="card"><b>{hours(payroll.reduce((n,e)=>n+e.totalPayableMinutes,0))}</b><span>Total payable</span></div></>}
      {mode === "billing" && <div className="card"><b>{money(charges.filter(c=>!c.excluded).reduce((n,c)=>n+Number(c.grossAmount),0))}</b><span>Reviewed gross</span></div>}
    </div>
    <div className="toolbar">
      <select className="field" value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">All records</option><option value="EXCEPTIONS">Exceptions</option>{mode==="payroll"?<option value="UNREVIEWED">Unreviewed</option>:<option value="ADJUSTED">Adjusted</option>}<option value="EXCLUDED">Excluded</option></select>
      {mode==="payroll"&&<button className="btn secondary" disabled={!selected.length||!rules.edit} onClick={bulkReview}>Review selected clean records</button>}
      <button className="btn secondary" disabled={!rules.approve} onClick={()=>transition("approve")}>Approve</button>
      <button className="btn secondary" disabled={!rules.lock} onClick={()=>transition("lock")}>Lock</button>
      <button className="btn primary" disabled={!rules.generate} onClick={generate}>{mode==="payroll"?"Generate payroll PDF":"Generate invoices"}</button>{mode==="billing"&&rules.download&&<button className="btn primary" onClick={downloadBundle}>Download invoice package</button>}{mode==="payroll"&&rules.download&&<a className="btn primary" href="/dashboard/reports/payroll">Payroll export history</a>}
    </div>
    <section className="card table-wrap">
      <table className="table"><thead><tr>{mode==="payroll"&&<th>Select</th>}<th>{mode==="payroll"?"Employee":"Service user"}</th><th>Reference / payer</th><th>{mode==="payroll"?"Regular":"Description"}</th><th>{mode==="payroll"?"Overtime":"Net"}</th><th>{mode==="payroll"?"Adjustments":"VAT"}</th><th>{mode==="payroll"?"Final payable":"Gross"}</th><th>Exception / review</th><th>Actions</th></tr></thead>
      <tbody>{visible.map(record=>mode==="payroll"?(()=>{const e=record as Entry,open=openId===e.id;return <><tr key={e.id}>{<td><input autoComplete="off" type="checkbox" checked={selected.includes(e.id)} onChange={event=>setSelected(event.target.checked?[...selected,e.id]:selected.filter(x=>x!==e.id))}/></td>}<td>{e.staffName}</td><td>{e.payrollNumber||"Not configured"}</td><td>{hours(e.ordinaryMinutes)}</td><td>{hours(e.overtimeMinutes)}<small style={{display:"block"}}>{e.overtimeHourlyRate != null || e.hourlyRate != null ? `@ GBP ${Number(e.overtimeHourlyRate ?? e.hourlyRate).toFixed(2)}/hour` : "Rate not configured"}</small></td><td>{hours(e.adjustmentMinutes)}</td><td>{hours(e.totalPayableMinutes)}</td><td>{e.exceptionStatus} ({e.exceptionCount})</td><td><div className="table-actions"><button className="btn secondary" onClick={()=>setOpenId(open?undefined:e.id)}>Details</button><button className="btn secondary" disabled={!rules.edit} onClick={()=>reasoned("note-entry",e.id)}>Add note</button><button className="btn secondary" disabled={!rules.edit} onClick={()=>act("review-entry",{entryId:e.id,resolved:e.exceptionCount>0})}>Mark reviewed</button><button className="btn secondary" disabled={!rules.edit} onClick={()=>addAdjustment(e)}>Adjust</button><button className="btn secondary" disabled={!rules.edit} onClick={()=>reasoned(e.exceptionStatus==="EXCLUDED"?"restore-entry":"exclude-entry",e.id)}>{e.exceptionStatus==="EXCLUDED"?"Restore":"Exclude"}</button></div></td></tr>{open&&<tr key={`${e.id}-detail`}><td colSpan={9}><div className="grid"><b>Calculation source</b><p>{(e.sourceSnapshot.exceptions||[]).join(", ")||"No recorded exception."}</p><table className="table"><thead><tr><th>Clock event</th><th>Timestamp</th><th>Source</th></tr></thead><tbody>{(e.sourceSnapshot.events||[]).map(event=><tr key={event.id}><td>{event.type}</td><td>{new Date(event.at).toLocaleString("en-GB")}</td><td>{event.offline?"Late synchronised":"Server recorded"} · <a href={`/timesheets?event=${event.id}`}>Open source</a></td></tr>)}</tbody></table>{(run.adjustments||[]).filter(a=>a.staffId===e.staffId).map(a=><p key={a.id}>{a.category}: {a.minutes} min · {a.reason}</p>)}</div></td></tr>}</>})():(()=>{const c=record as Charge;return <tr key={c.id}><td>{c.studentName}</td><td>{c.payerName}</td><td>{c.description}</td><td>{money(c.netAmount)}</td><td>{money(c.vatAmount)}</td><td>{money(c.grossAmount)}</td><td>{c.excluded?"EXCLUDED":c.exceptionCode||"CLEAR"}{c.adjustmentReason&&<small><br/>{c.adjustmentReason}</small>}</td><td><div className="table-actions">{c.sourceAttendanceId&&<a className="btn secondary" href={`/reports?attendance=${c.sourceAttendanceId}`}>Source</a>}<button className="btn secondary" disabled={!rules.edit} onClick={()=>reasoned("note-charge",c.id)}>Add note</button>{c.exceptionCode&&<button className="btn secondary" disabled={!rules.edit} onClick={()=>reasoned("resolve-charge",c.id)}>Resolve</button>}<button className="btn secondary" disabled={!rules.edit} onClick={()=>reasoned(c.excluded?"restore-charge":"exclude-charge",c.id)}>{c.excluded?"Restore":"Exclude"}</button></div></td></tr>})())}</tbody></table>
      {!visible.length&&<div className="empty">No records match this filter.</div>}
    </section>
    {(run.auditHistory||[]).length>0&&<section className="card"><h2>Audit history</h2>{run.auditHistory!.map(item=><p key={item.id}><b>{item.action.replaceAll("_"," ")}</b> · {new Date(item.createdAt).toLocaleString("en-GB")} · actor {item.actorId||"SYSTEM"}</p>)}</section>}
    {(run.invoices||[]).length>0&&<section className="card"><h2>Generated invoices</h2>{run.invoices!.map(i=><p key={i.id}>{i.invoiceNumber} · {money(i.grossTotal)} {i.documentId&&<a className="btn secondary" href={`/api/documents/${i.documentId}/download`}>Download</a>}</p>)}</section>}
  </>;
}
