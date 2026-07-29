"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, CreditCard, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { appConfirm } from "@/lib/app-dialog";

type BillingProfile = {
  id: string; payerType: string; payerName: string; billingAddress: string; billingEmail?: string;
  activeFrom: string; activeTo?: string; vatTreatment: string; vatRate: number | string;
  chargeRules: Array<{ rate: number | string }>;
};
type Student = {
  id: string; firstName: string; lastName: string; displayName: string; active: boolean;
  startDate: string; endDate?: string; expectedDays: number[]; internalReference?: string; notes?: string;
  emergencyContactName?: string; emergencyContactRelationship?: string; emergencyContactPhone?: string;
  emergencyContactAlternativePhone?: string; emergencyContactEmail?: string; emergencyContactNotes?: string;
  billingProfile?: BillingProfile | null;
};

const emptyBilling = {
  enabled: false, profileId: "", payerType: "Local authority", payerName: "", billingAddress: "",
  billingEmail: "", activeFrom: new Date().toISOString().slice(0, 10),
  vatTreatment: "OUTSIDE_SCOPE", vatRate: 0, rate: 0,
};
const blank = {
  firstName: "", lastName: "", displayName: "", startDate: "", endDate: "", expectedDays: [1, 2, 3, 4, 5],
  internalReference: "", notes: "",
  emergencyContactName: "", emergencyContactRelationship: "", emergencyContactPhone: "",
  emergencyContactAlternativePhone: "", emergencyContactEmail: "", emergencyContactNotes: "",
  billing: emptyBilling,
};
const days = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"]] as const;

function billingForm(profile?: BillingProfile | null) {
  if (!profile) return { ...emptyBilling };
  return {
    enabled: true, profileId: profile.id, payerType: profile.payerType, payerName: profile.payerName,
    billingAddress: profile.billingAddress, billingEmail: profile.billingEmail || "",
    activeFrom: profile.activeFrom.slice(0, 10), vatTreatment: profile.vatTreatment,
    vatRate: Number(profile.vatRate), rate: Number(profile.chargeRules[0]?.rate || 0),
  };
}

export function StudentManagerV2() {
  const [rows, setRows] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState<Student | null | "new">(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManageBilling, setCanManageBilling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/students/records?status=${status}&search=${encodeURIComponent(search)}`, { cache: "no-store" });
    if (response.status === 403) { location.href = "/login"; return; }
    setRows(response.ok ? await response.json() : []);
    setLoading(false);
  }, [search, status]);

  useEffect(() => {
    fetch("/api/auth/me").then(response => response.ok ? response.json() : null).then(user => setCanManageBilling(Boolean(user && ["DIRECTOR", "ADMINISTRATOR"].includes(user.role))));
  }, []);
  useEffect(() => { const id = setTimeout(load, 200); return () => clearTimeout(id); }, [load]);

  function open(row?: Student) {
    setEditing(row || "new"); setError(""); setNotice("");
    setForm(row ? {
      firstName: row.firstName, lastName: row.lastName, displayName: row.displayName,
      startDate: row.startDate.slice(0, 10), endDate: row.endDate?.slice(0, 10) || "",
      expectedDays: (row.expectedDays || []).map(Number), internalReference: row.internalReference || "", notes: row.notes || "",
      emergencyContactName: row.emergencyContactName || "", emergencyContactRelationship: row.emergencyContactRelationship || "",
      emergencyContactPhone: row.emergencyContactPhone || "", emergencyContactAlternativePhone: row.emergencyContactAlternativePhone || "",
      emergencyContactEmail: row.emergencyContactEmail || "", emergencyContactNotes: row.emergencyContactNotes || "",
      billing: billingForm(row.billingProfile),
    } : { ...blank, billing: { ...emptyBilling } });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const isNew = editing === "new";
    const billing = canManageBilling && form.billing.enabled
      ? { ...form.billing, profileId: form.billing.profileId || undefined }
      : undefined;
    const body = { ...form, billing };
    const response = await fetch(isNew ? "/api/students/records" : `/api/students/records/${(editing as Student).id}`, {
      method: isNew ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error || "Unable to save the student.");
    setEditing(null); setNotice(isNew ? "Student added." : "Student details updated."); await load();
  }

  async function setActive(row: Student, active: boolean) {
    if (!await appConfirm(`${active ? "Restore" : "Archive"} ${row.displayName}? Historic attendance and billing records will be preserved.`)) return;
    await fetch(`/api/students/records/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active }) });
    await load();
  }

  return <>
    {notice && <div className="alert alert-success">{notice}</div>}
    <div className="toolbar">
      <label style={{ position: "relative" }}><Search size={18} style={{ position: "absolute", left: 13, top: 16 }}/><input autoComplete="off" className="field" style={{ paddingLeft: 40 }} placeholder="Search students" value={search} onChange={event => setSearch(event.target.value)}/></label>
      <select className="field" value={status} onChange={event => setStatus(event.target.value)}><option value="active">Active students</option><option value="archived">Archived students</option><option value="all">All students</option></select>
      <button className="btn primary" style={{ marginLeft: "auto" }} onClick={() => open()}><Plus size={18}/>Add student</button>
    </div>
    <section className="card table-wrap">{loading ? <div className="empty">Loading students…</div> : rows.length ? <table className="table">
      <thead><tr><th>Name</th><th>Reference</th><th>Expected days</th><th>Emergency contact</th><th>Billing</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td><b>{row.displayName}</b></td><td>{row.internalReference || "—"}</td>
        <td>{(row.expectedDays || []).map(Number).map(number => days.find(day => day[0] === number)?.[1]).join(", ") || "None"}</td>
        <td>{row.emergencyContactName ? <><b>{row.emergencyContactName}</b><small className="muted" style={{ display: "block" }}>{row.emergencyContactPhone || "No telephone"}</small></> : <span className="badge badge-warning">Not configured</span>}</td>
        <td>{row.billingProfile ? <><span className={`badge ${row.billingProfile.activeTo ? "badge-neutral" : "badge-success"}`}>{row.billingProfile.activeTo ? "Ended" : "Configured"}</span><small className="muted" style={{ display: "block" }}>{row.billingProfile.payerName}</small></> : canManageBilling ? <span className="badge badge-warning">Not configured</span> : "—"}</td>
        <td><span className={`badge ${row.active ? "badge-success" : "badge-neutral"}`}>{row.active ? "Active" : "Archived"}</span></td>
        <td><div style={{ display: "flex", gap: 7 }}><button className="btn ghost" onClick={() => open(row)} aria-label={`Edit ${row.displayName}`}><Pencil size={17}/></button><button className={`btn ${row.active ? "danger" : "secondary"}`} onClick={() => setActive(row, !row.active)}>{row.active ? <Archive size={17}/> : <RotateCcw size={17}/>}</button></div></td>
      </tr>)}</tbody>
    </table> : <div className="empty"><b>No students found</b><p>Change the filters or add a student.</p></div>}</section>

    {editing && <div className="modal-backdrop" role="presentation"><form autoComplete="off" className="modal student-record-modal" onSubmit={save}>
      <h2>{editing === "new" ? "Add student" : `Edit ${(editing as Student).displayName}`}</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <h3>Student details</h3><div className="form-grid">
        <label className="form-label">First name<input autoComplete="off" className="field" required value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })}/></label>
        <label className="form-label">Surname<input autoComplete="off" className="field" required value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })}/></label>
        <label className="form-label">Display name<input autoComplete="off" className="field" required value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })}/></label>
        <label className="form-label">Internal reference<input autoComplete="off" className="field" value={form.internalReference} onChange={event => setForm({ ...form, internalReference: event.target.value })}/></label>
        <label className="form-label">Start date<input className="field" type="date" required value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })}/></label>
        <label className="form-label">End date<input className="field" type="date" value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })}/></label>
        <fieldset className="full record-fieldset"><legend>Expected attendance days</legend><div className="check-list">{days.map(([number, label]) => <label key={number}><input type="checkbox" checked={form.expectedDays.includes(number)} onChange={event => setForm({ ...form, expectedDays: event.target.checked ? [...form.expectedDays, number].sort() : form.expectedDays.filter(value => value !== number) })}/> {label}</label>)}</div></fieldset>
      </div>

      <h3>Emergency contact</h3><p className="muted">Protected manager information. These details are not downloaded to kiosk tablets.</p><div className="form-grid">
        <label className="form-label">Contact name<input autoComplete="off" className="field" value={form.emergencyContactName} onChange={event => setForm({ ...form, emergencyContactName: event.target.value })}/></label>
        <label className="form-label">Relationship<input autoComplete="off" className="field" value={form.emergencyContactRelationship} onChange={event => setForm({ ...form, emergencyContactRelationship: event.target.value })}/></label>
        <label className="form-label">Primary telephone<input autoComplete="off" className="field" inputMode="tel" value={form.emergencyContactPhone} onChange={event => setForm({ ...form, emergencyContactPhone: event.target.value })}/></label>
        <label className="form-label">Alternative telephone<input autoComplete="off" className="field" inputMode="tel" value={form.emergencyContactAlternativePhone} onChange={event => setForm({ ...form, emergencyContactAlternativePhone: event.target.value })}/></label>
        <label className="form-label full">Email<input autoComplete="off" className="field" type="email" value={form.emergencyContactEmail} onChange={event => setForm({ ...form, emergencyContactEmail: event.target.value })}/></label>
        <label className="form-label full">Emergency contact notes<textarea autoComplete="off" className="field" value={form.emergencyContactNotes} onChange={event => setForm({ ...form, emergencyContactNotes: event.target.value })}/></label>
      </div>

      {canManageBilling && <><h3><CreditCard size={19}/> Billing setup</h3>
        <label className="check-row"><input type="checkbox" checked={form.billing.enabled} onChange={event => setForm({ ...form, billing: { ...form.billing, enabled: event.target.checked } })}/><span>{form.billing.profileId ? "Edit this student’s billing profile" : "Set up billing when this student is saved"}</span></label>
        {form.billing.enabled && <div className="form-grid billing-inline">
          <label className="form-label">Who pays?<select className="field" value={form.billing.payerType} onChange={event => setForm({ ...form, billing: { ...form.billing, payerType: event.target.value } })}>{["Local authority", "Funding organisation", "Private payer", "Family member", "Care provider", "Business", "Other"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="form-label">Payer/organisation name<input autoComplete="off" className="field" required value={form.billing.payerName} onChange={event => setForm({ ...form, billing: { ...form.billing, payerName: event.target.value } })}/></label>
          <label className="form-label">Agreed day rate (£)<input className="field" type="number" min="0" step="0.01" required value={form.billing.rate} onChange={event => setForm({ ...form, billing: { ...form.billing, rate: Number(event.target.value) } })}/></label>
          <label className="form-label">Use from<input className="field" type="date" required value={form.billing.activeFrom} onChange={event => setForm({ ...form, billing: { ...form.billing, activeFrom: event.target.value } })}/></label>
          <label className="form-label full">Invoice address<textarea autoComplete="off" className="field" required value={form.billing.billingAddress} onChange={event => setForm({ ...form, billing: { ...form.billing, billingAddress: event.target.value } })}/></label>
          <label className="form-label">Invoice email<input autoComplete="off" className="field" type="email" value={form.billing.billingEmail} onChange={event => setForm({ ...form, billing: { ...form.billing, billingEmail: event.target.value } })}/></label>
          <label className="form-label">VAT treatment<select className="field" value={form.billing.vatTreatment} onChange={event => setForm({ ...form, billing: { ...form.billing, vatTreatment: event.target.value } })}><option value="OUTSIDE_SCOPE">Outside scope</option><option value="EXEMPT">Exempt</option><option value="STANDARD">Standard rate</option><option value="ZERO_RATED">Zero rated</option></select></label>
          <label className="form-label">VAT rate (%)<input className="field" type="number" min="0" max="100" step="0.01" value={form.billing.vatRate} onChange={event => setForm({ ...form, billing: { ...form.billing, vatRate: Number(event.target.value) } })}/></label>
        </div>}
      </>}

      <label className="form-label"><h3>Restricted manager notes</h3><textarea autoComplete="off" className="field" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })}/></label>
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save student"}</button></div>
    </form></div>}
  </>;
}
