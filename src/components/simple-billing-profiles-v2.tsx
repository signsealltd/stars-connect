"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Square, Trash2 } from "lucide-react";
import { appConfirm, appReasonPrompt } from "@/lib/app-dialog";
import { billingProfileReasons } from "@/lib/operational-reasons";

type Student = { id: string; displayName: string };
type Profile = {
  id: string; studentId: string; payerType: string; payerName: string; billingAddress: string;
  billingEmail?: string; activeFrom: string; activeTo?: string; vatTreatment: string;
  vatRate: number | string; chargeRules: Array<{ rate?: number | string }>;
};
const empty = {
  studentId: "", payerType: "Local authority", payerName: "", billingAddress: "", billingEmail: "",
  activeFrom: new Date().toISOString().slice(0, 10), vatTreatment: "OUTSIDE_SCOPE", vatRate: 0, rate: 0,
};

export function SimpleBillingProfilesV2({ initialStudentId = "", returnTo = "" }: { initialStudentId?: string; returnTo?: string }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState({ ...empty, studentId: initialStudentId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    const [profileResponse, studentResponse] = await Promise.all([fetch("/api/billing/profiles", { cache: "no-store" }), fetch("/api/students/records?status=all", { cache: "no-store" })]);
    if (profileResponse.ok) setProfiles(await profileResponse.json());
    if (studentResponse.ok) setStudents(await studentResponse.json());
  }
  useEffect(() => { void load(); }, []);

  function edit(profile: Profile) {
    setEditingId(profile.id); setError(""); setSuccess("");
    setForm({
      studentId: profile.studentId, payerType: profile.payerType, payerName: profile.payerName,
      billingAddress: profile.billingAddress, billingEmail: profile.billingEmail || "",
      activeFrom: profile.activeFrom.slice(0, 10), vatTreatment: profile.vatTreatment,
      vatRate: Number(profile.vatRate), rate: Number(profile.chargeRules[0]?.rate || 0),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditingId(undefined); setForm({ ...empty, studentId: initialStudentId }); setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const reason = editingId ? await appReasonPrompt("Why are these billing details being changed?", billingProfileReasons) : null;
    if (editingId && (!reason || reason.trim().length < 5)) { setSaving(false); return setError("Enter a reason of at least five characters."); }
    const common = {
      payerType: form.payerType, payerName: form.payerName, billingAddress: form.billingAddress,
      billingEmail: form.billingEmail, activeFrom: form.activeFrom, vatTreatment: form.vatTreatment,
      vatRate: Number(form.vatRate), rate: Number(form.rate),
    };
    const body = editingId ? { action: "update", ...common, reason } : {
      studentId: form.studentId, ...common, paymentTermsDays: 30, consolidatedByPayer: false,
      chargeRules: [{
        chargeType: "FULL_DAY", description: "Attended day", unitType: "DAY", rate: Number(form.rate),
        attendanceDependency: "ATTENDED", applicableWeekdays: [1, 2, 3, 4, 5, 6, 7],
        vatTreatment: form.vatTreatment, vatRate: Number(form.vatRate),
      }],
    };
    const response = await fetch(editingId ? `/api/billing/profiles/${editingId}/manage` : "/api/billing/profiles", {
      method: editingId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const result = await response.json(); setSaving(false);
    if (!response.ok) return setError(result.error || "Unable to save the billing profile.");
    setSuccess(editingId ? "Billing profile updated." : "Billing profile created.");
    reset(); await load();
    if (returnTo) window.location.assign(returnTo);
  }

  async function end(profile: Profile) {
    const reason = await appReasonPrompt(`Why is ${profile.payerName}'s billing profile being ended?`, billingProfileReasons);
    if (!reason || reason.trim().length < 5) return;
    const activeTo = new Date().toISOString().slice(0, 10);
    const response = await fetch(`/api/billing/profiles/${profile.id}/manage`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "end", activeTo, reason }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error || "Unable to end the profile.");
    setSuccess("Billing profile ended. Historic billing remains available."); await load();
  }

  async function remove(profile: Profile) {
    if (!await appConfirm(`Delete the unused billing profile for ${profile.payerName}? Profiles already used by a billing run cannot be deleted.`)) return;
    const reason = await appReasonPrompt("Why is this unused billing profile being deleted?", billingProfileReasons);
    if (!reason || reason.trim().length < 5) return;
    const response = await fetch(`/api/billing/profiles/${profile.id}/manage`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error || "Unable to delete the profile.");
    setSuccess("Unused billing profile deleted."); await load();
  }

  const selectedName = students.find(student => student.id === form.studentId)?.displayName;
  return <>
    <div className="alert alert-warning"><b>Plain English:</b> the payer receives and pays the invoice. The day rate is the agreed charge when the service user attends.</div>
    <form autoComplete="off" className="card form-grid" onSubmit={save}>
      <h2 className="full">{editingId ? `Edit billing for ${selectedName || "service user"}` : selectedName ? `Set up billing for ${selectedName}` : "Set up a service user"}</h2>
      <label className="form-label">Service user<select className="field" required disabled={Boolean(editingId)} value={form.studentId} onChange={event => setForm({ ...form, studentId: event.target.value })}><option value="">Choose a service user</option>{students.map(student => <option key={student.id} value={student.id}>{student.displayName}</option>)}</select></label>
      <label className="form-label">Who pays?<select className="field" value={form.payerType} onChange={event => setForm({ ...form, payerType: event.target.value })}>{["Local authority", "Funding organisation", "Private payer", "Family member", "Care provider", "Business", "Other"].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="form-label">Payer or organisation name<input autoComplete="off" className="field" required value={form.payerName} onChange={event => setForm({ ...form, payerName: event.target.value })}/></label>
      <label className="form-label">Agreed day rate (£)<input className="field" type="number" min="0" step="0.01" required value={form.rate} onChange={event => setForm({ ...form, rate: Number(event.target.value) })}/></label>
      <label className="form-label">Invoice email<input autoComplete="off" className="field" type="email" value={form.billingEmail} onChange={event => setForm({ ...form, billingEmail: event.target.value })}/></label>
      <label className="form-label">Use from<input className="field" type="date" required value={form.activeFrom} onChange={event => setForm({ ...form, activeFrom: event.target.value })}/></label>
      <label className="form-label full">Invoice address<textarea autoComplete="off" className="field" required value={form.billingAddress} onChange={event => setForm({ ...form, billingAddress: event.target.value })}/></label>
      <label className="form-label">VAT treatment<select className="field" value={form.vatTreatment} onChange={event => setForm({ ...form, vatTreatment: event.target.value })}><option value="OUTSIDE_SCOPE">Outside scope</option><option value="EXEMPT">Exempt</option><option value="STANDARD">Standard rate</option><option value="ZERO_RATED">Zero rated</option></select></label>
      <label className="form-label">VAT rate (%)<input className="field" type="number" min="0" max="100" step="0.01" value={form.vatRate} onChange={event => setForm({ ...form, vatRate: Number(event.target.value) })}/></label>
      {error && <div className="alert alert-error full">{error}</div>}{success && <div className="alert alert-success full">{success}</div>}
      <div className="full table-actions"><button className="btn primary" disabled={saving}>{editingId ? <Pencil size={17}/> : <Plus size={17}/>} {saving ? "Saving…" : editingId ? "Save changes" : "Save billing setup"}</button>{editingId && <button type="button" className="btn secondary" onClick={reset}>Cancel editing</button>}{returnTo && <a className="btn secondary" href={returnTo}>Return</a>}</div>
    </form>
    <section className="card table-wrap"><table className="table">
      <thead><tr><th>Service user</th><th>Payer</th><th>Day rate</th><th>VAT</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{profiles.map(profile => <tr key={profile.id}>
        <td>{students.find(student => student.id === profile.studentId)?.displayName || "Unknown service user"}</td><td>{profile.payerName}<small className="muted" style={{ display: "block" }}>{profile.payerType}</small></td>
        <td>£{Number(profile.chargeRules[0]?.rate || 0).toFixed(2)}</td><td>{profile.vatTreatment.replaceAll("_", " ").toLowerCase()} {Number(profile.vatRate) ? `${Number(profile.vatRate)}%` : ""}</td>
        <td><span className={`badge ${profile.activeTo ? "badge-neutral" : "badge-success"}`}>{profile.activeTo ? `Ended ${new Date(profile.activeTo).toLocaleDateString("en-GB")}` : "Active"}</span></td>
        <td><div className="table-actions"><button className="btn ghost" onClick={() => edit(profile)}><Pencil size={16}/>Edit</button>{!profile.activeTo && <button className="btn secondary" onClick={() => end(profile)}><Square size={15}/>End</button>}<button className="btn danger" onClick={() => remove(profile)}><Trash2 size={16}/>Delete</button></div></td>
      </tr>)}</tbody>
    </table>{!profiles.length && <div className="empty"><b>No billing profiles yet</b><p>Billing can be set up here or while adding a student.</p></div>}</section>
  </>;
}
