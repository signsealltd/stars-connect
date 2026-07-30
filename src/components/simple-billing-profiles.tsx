"use client";

import { useEffect, useState } from "react";

type Student = { id: string; displayName: string };
type Profile = { id: string; studentId: string; payerName: string; payerType: string; vatTreatment: string; vatRate: number | string; chargeRules: Array<{ rate?: number | string }> };

export function SimpleBillingProfiles({ initialStudentId = "", returnTo = "" }: { initialStudentId?: string; returnTo?: string }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    studentId: initialStudentId, payerType: "Local authority", payerName: "", billingAddress: "", billingEmail: "",
    activeFrom: new Date().toISOString().slice(0, 10), vatTreatment: "OUTSIDE_SCOPE", vatRate: 0, rate: 0,
  });

  async function load() {
    const [profilesResponse, studentsResponse] = await Promise.all([fetch("/api/billing/profiles"), fetch("/api/students/manage")]);
    if (profilesResponse.ok) setProfiles(await profilesResponse.json());
    if (studentsResponse.ok) {
      const body = await studentsResponse.json();
      setStudents(Array.isArray(body) ? body : body.students || []);
    }
  }
  useEffect(() => { load(); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const body = {
      ...form, paymentTermsDays: 30, consolidatedByPayer: false,
      chargeRules: [{
        chargeType: "FULL_DAY", description: "Attended day", unitType: "DAY", rate: Number(form.rate),
        attendanceDependency: "ATTENDED", applicableWeekdays: [1, 2, 3, 4, 5, 6, 7],
        vatTreatment: form.vatTreatment, vatRate: Number(form.vatRate),
      }],
    };
    const response = await fetch("/api/billing/profiles", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error || "Unable to save the billing profile. Check every required field.");
    setSuccess("Billing profile saved. Future billing runs will use these details automatically.");
    await load();
    if (returnTo) window.location.assign(returnTo);
  }

  const selectedName = students.find(student => student.id === form.studentId)?.displayName;
  return <>
    <div className="alert alert-warning">
      <b>Plain English:</b> the payer is whoever receives and pays the invoice. The day rate is the agreed amount charged when this service user attends. Create one profile per service user; you do not enter it again for every billing run.
    </div>
    <form autoComplete="off" className="card form-grid" onSubmit={save}>
      <h2 className="full">{selectedName ? `Set up billing for ${selectedName}` : "Set up a service user"}</h2>
      <label className="form-label">Service user<select className="field" required value={form.studentId} onChange={event => setForm({ ...form, studentId: event.target.value })}><option value="">Choose a service user</option>{students.map(student => <option key={student.id} value={student.id}>{student.displayName}</option>)}</select></label>
      <label className="form-label">Who pays?<select className="field" value={form.payerType} onChange={event => setForm({ ...form, payerType: event.target.value })}>{["Local authority", "Funding organisation", "Private payer", "Family member", "Care provider", "Business", "Other"].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="form-label">Payer or organisation name<input autoComplete="off" className="field" required value={form.payerName} onChange={event => setForm({ ...form, payerName: event.target.value })}/></label>
      <label className="form-label">Agreed day rate (£)<input autoComplete="off" className="field" type="number" min="0" step="0.01" required value={form.rate} onChange={event => setForm({ ...form, rate: Number(event.target.value) })}/></label>
      <label className="form-label">Invoice email (optional)<input autoComplete="off" className="field" type="email" value={form.billingEmail} onChange={event => setForm({ ...form, billingEmail: event.target.value })}/></label>
      <label className="form-label">Use from<input autoComplete="off" className="field" type="date" required value={form.activeFrom} onChange={event => setForm({ ...form, activeFrom: event.target.value })}/></label>
      <label className="form-label full">Invoice address<textarea autoComplete="off" className="field" required value={form.billingAddress} onChange={event => setForm({ ...form, billingAddress: event.target.value })}/></label>
      <label className="form-label">VAT treatment<select className="field" value={form.vatTreatment} onChange={event => setForm({ ...form, vatTreatment: event.target.value })}><option value="OUTSIDE_SCOPE">Outside scope</option><option value="EXEMPT">Exempt</option><option value="STANDARD">Standard rate</option><option value="ZERO_RATED">Zero rated</option></select></label>
      <label className="form-label">VAT rate (%)<input autoComplete="off" className="field" type="number" min="0" max="100" step="0.01" value={form.vatRate} onChange={event => setForm({ ...form, vatRate: Number(event.target.value) })}/></label>
      {error && <div className="alert alert-error full">{error}</div>}
      {success && <div className="alert alert-success full">{success}</div>}
      <div className="full table-actions"><button className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save billing setup"}</button>{returnTo && <a className="btn secondary" href={returnTo}>Cancel</a>}</div>
    </form>
    <section className="card table-wrap"><table className="table">
      <thead><tr><th>Service user</th><th>Payer</th><th>Type</th><th>Day rate</th><th>VAT</th></tr></thead>
      <tbody>{profiles.map(profile => <tr key={profile.id}><td>{students.find(student => student.id === profile.studentId)?.displayName || "Unknown service user"}</td><td>{profile.payerName}</td><td>{profile.payerType}</td><td>£{Number(profile.chargeRules[0]?.rate || 0).toFixed(2)}</td><td>{profile.vatTreatment.replaceAll("_", " ").toLowerCase()} {Number(profile.vatRate) ? `${Number(profile.vatRate)}%` : ""}</td></tr>)}</tbody>
    </table>{!profiles.length && <div className="empty"><b>No billing profiles yet</b><p>Use the form above to set up the first service user.</p></div>}</section>
  </>;
}
