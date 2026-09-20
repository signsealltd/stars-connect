"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, Search, Square, Trash2, X, FileText } from "lucide-react";
import { appConfirm, appReasonPrompt } from "@/lib/app-dialog";
import { billingProfileReasons } from "@/lib/operational-reasons";

import styles from "./billing-profiles.module.css";

type Student = { id: string; displayName: string };
type Profile = {
  id: string; studentId: string; payerType: string; payerName: string; billingAddress: string;
  purchaseOrderNumber?: string; billingEmail?: string; activeFrom: string; activeTo?: string; vatTreatment: string;
  vatRate: number | string; chargeRules: Array<{ rate?: number | string; fundedDayCount?:number|string|null; attendanceDependency:string; activeFrom:string }>;
};
const empty = {
  fundedDayCount: "" as number|"", purchaseOrderNumber:"", studentId: "", payerType: "Local authority", payerName: "", billingAddress: "", billingEmail: "",
  activeFrom: new Date().toISOString().slice(0, 10), vatTreatment: "OUTSIDE_SCOPE", vatRate: 0, rate: 0,
};

export function SimpleBillingProfilesV2({ initialStudentId = "", returnTo = "" }: { initialStudentId?: string; returnTo?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const initialOpened = useRef(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { if(open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState({ ...empty, studentId: initialStudentId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const [profileResponse, studentResponse] = await Promise.all([fetch("/api/billing/profiles", { cache: "no-store" }), fetch("/api/students/records?status=all", { cache: "no-store" })]);
    if (profileResponse.ok) {
      const loadedProfiles: Profile[] = await profileResponse.json();
      setProfiles(loadedProfiles);
      const selected = initialStudentId ? loadedProfiles.find(profile => profile.studentId === initialStudentId && !profile.activeTo) : undefined;
      if (selected && !initialOpened.current) {
        setEditingId(selected.id);
        setForm({ fundedDayCount:selected.chargeRules[0]?.fundedDayCount!=null?Number(selected.chargeRules[0].fundedDayCount):"",purchaseOrderNumber:selected.purchaseOrderNumber||"",studentId:selected.studentId,payerType:selected.payerType,payerName:selected.payerName,billingAddress:selected.billingAddress,billingEmail:selected.billingEmail||"",activeFrom:(selected.chargeRules[0]?.activeFrom||selected.activeFrom).slice(0,10),vatTreatment:selected.vatTreatment,vatRate:Number(selected.vatRate),rate:Number(selected.chargeRules[0]?.rate||0) });
      }
    }
    if (studentResponse.ok) setStudents(await studentResponse.json());
    if(!profileResponse.ok || !studentResponse.ok) setError("Unable to load billing profiles. Please refresh and try again.");
    if(initialStudentId && !initialOpened.current){initialOpened.current=true;setOpen(true)}
    setLoading(false);
  }, [initialStudentId]);
  useEffect(() => { void load().catch(()=>{setLoading(false);setError("Unable to load billing profiles. Please refresh and try again.")}); }, [load]);

  function edit(profile: Profile) {
    setEditingId(profile.id); setError(""); setSuccess("");
    setForm({
      fundedDayCount:profile.chargeRules[0]?.fundedDayCount!=null?Number(profile.chargeRules[0].fundedDayCount):"",purchaseOrderNumber:profile.purchaseOrderNumber||"",studentId: profile.studentId, payerType: profile.payerType, payerName: profile.payerName,
      billingAddress: profile.billingAddress, billingEmail: profile.billingEmail || "",
      activeFrom: (profile.chargeRules[0]?.activeFrom||profile.activeFrom).slice(0, 10), vatTreatment: profile.vatTreatment,
      vatRate: Number(profile.vatRate), rate: Number(profile.chargeRules[0]?.rate || 0),
    });
    setClientSearch(""); setChangeReason(""); setOpen(true);
  }

  function reset() {
    setClientSearch(""); setChangeReason(""); setEditingId(undefined); setForm({ ...empty, studentId: initialStudentId }); setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const reason = editingId ? changeReason.trim() : null;
    if (editingId && (!reason || reason.trim().length < 5)) { setSaving(false); return setError("Enter a reason of at least five characters."); }
    const common = {
      fundedDayCount:form.fundedDayCount===""?null:Number(form.fundedDayCount),purchaseOrderNumber:form.purchaseOrderNumber,payerType: form.payerType, payerName: form.payerName, billingAddress: form.billingAddress,
      billingEmail: form.billingEmail, activeFrom: form.activeFrom, vatTreatment: form.vatTreatment,
      vatRate: Number(form.vatRate), rate: Number(form.rate),
    };
    const body = editingId ? { action: "update", ...common, reason } : {
      studentId: form.studentId, ...common, paymentTermsDays: 30, consolidatedByPayer: false,
      chargeRules: [{
        chargeType: "FULL_DAY", description: "Agreed funded day", unitType: "DAY", rate: Number(form.rate),
        attendanceDependency: "FUNDED", fundedDayCount: form.fundedDayCount===""?null:Number(form.fundedDayCount), applicableWeekdays: [],
        vatTreatment: form.vatTreatment, vatRate: Number(form.vatRate),
      }],
    };
    try {
    const response = await fetch(editingId ? `/api/billing/profiles/${editingId}/manage` : "/api/billing/profiles", {
      method: editingId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const result = await response.json(); setSaving(false);
    if (!response.ok) return setError(result.error || "Unable to save the billing profile.");
    setSuccess(editingId ? "Billing profile updated." : "Billing profile created.");
    setOpen(false); reset(); await load();
    if (returnTo) window.location.assign(returnTo);
    } catch { setError("Unable to save billing details. Check your connection and try again."); } finally { setSaving(false); }
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
  const filteredProfiles=profiles.filter(profile=>[students.find(client=>client.id===profile.studentId)?.displayName,profile.payerName,profile.purchaseOrderNumber].some(value=>value?.toLowerCase().includes(search.trim().toLowerCase())));
  const filteredClients=students.filter(client=>client.id===form.studentId||client.displayName.toLowerCase().includes(clientSearch.trim().toLowerCase()));
  return <div className={styles.page}>
    <section className={styles.toolbar}><div><h2><FileText size={22}/> Client billing profiles</h2><p>Manage payers, agreed rates and payment references.</p></div><button className="btn primary" onClick={()=>{reset();setSuccess("");setOpen(true)}}><Plus size={18}/>Add New</button><label className={styles.search}><Search size={19}/><span className="sr-only">Search clients, payers or PO references</span><input className="field" type="search" placeholder="Search clients, payers or PO references" value={search} onChange={event=>setSearch(event.target.value)}/></label><small>{loading?"Loading profiles…":`${filteredProfiles.length} of ${profiles.length} profiles`}</small></section>{!open&&error&&<div role="alert" className="alert alert-error">{error}</div>}{success&&<div role="status" className="alert alert-success">{success}</div>}
    <dialog ref={dialog} className={styles.modal} aria-labelledby="billing-profile-title" onCancel={event=>{event.preventDefault();if(!saving)setOpen(false)}}><header className={styles.modalHeader}><div><span>Billing setup</span><h2 id="billing-profile-title">{editingId ? `Edit billing for ${selectedName || "client"}` : "Add billing profile"}</h2><p>The day rate applies to agreed funded days, regardless of attendance.</p></div><button type="button" className="btn ghost" aria-label="Close billing setup" disabled={saving} onClick={()=>setOpen(false)}><X size={20}/></button></header>
    <form autoComplete="off" className={`form-grid ${styles.form}`} onSubmit={save}>
      {!editingId&&<label className="form-label full">Find a client<input className="field" type="search" placeholder="Type a client name" value={clientSearch} onChange={event=>setClientSearch(event.target.value)}/></label>}
      <label className="form-label">Client<select className="field" required disabled={Boolean(editingId)} value={form.studentId} onChange={event => setForm({ ...form, studentId: event.target.value })}><option value="">Choose a client</option>{filteredClients.map(student => <option key={student.id} value={student.id}>{student.displayName}</option>)}</select></label>
      <label className="form-label full">PO / client payment reference<input className="field" value={form.purchaseOrderNumber} onChange={e=>setForm({...form,purchaseOrderNumber:e.target.value})}/></label><label className="form-label">Agreed funded days per billing period (optional)<input className="field" type="number" min={0} max={366} step={0.5} value={form.fundedDayCount} onChange={e=>setForm({...form,fundedDayCount:e.target.value===""?"":Number(e.target.value)})}/><small>You can leave this blank and confirm it later. Enter the number before bank holiday deductions. You can correct the count for each period when reviewing the draft. Register weekdays do not affect billing.</small></label><label className="form-label">Who pays?<select className="field" value={form.payerType} onChange={event => setForm({ ...form, payerType: event.target.value })}>{["Local authority", "Funding organisation", "Private payer", "Family member", "Care provider", "Business", "Other"].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="form-label">Payer or organisation name<input autoComplete="off" className="field" required value={form.payerName} onChange={event => setForm({ ...form, payerName: event.target.value })}/></label>
      <label className="form-label">Agreed day rate (£)<input className="field" type="number" min="0" step="0.01" required value={form.rate} onChange={event => setForm({ ...form, rate: Number(event.target.value) })}/></label>
      <label className="form-label">Invoice email<input autoComplete="off" className="field" type="email" value={form.billingEmail} onChange={event => setForm({ ...form, billingEmail: event.target.value })}/></label>
      <label className="form-label">Use from<input className="field" type="date" required value={form.activeFrom} onChange={event => setForm({ ...form, activeFrom: event.target.value })}/></label>
      <label className="form-label full">Invoice address<textarea autoComplete="off" className="field" required value={form.billingAddress} onChange={event => setForm({ ...form, billingAddress: event.target.value })}/></label>
      <label className="form-label">VAT treatment<select className="field" value={form.vatTreatment} onChange={event => setForm({ ...form, vatTreatment: event.target.value })}><option value="OUTSIDE_SCOPE">Outside scope</option><option value="EXEMPT">Exempt</option><option value="STANDARD">Standard rate</option><option value="ZERO_RATED">Zero rated</option></select></label>
      <label className="form-label">VAT rate (%)<input className="field" type="number" min="0" max="100" step="0.01" value={form.vatRate} onChange={event => setForm({ ...form, vatRate: Number(event.target.value) })}/></label>
      {editingId&&<label className="form-label full">Reason for change<input className="field" required minLength={5} maxLength={2000} value={changeReason} onChange={event=>setChangeReason(event.target.value)} placeholder="Brief reason for the audit history"/></label>}{error && <div role="alert" className="alert alert-error full">{error}</div>}
      <div className="full table-actions"><button className="btn primary" disabled={saving}>{editingId ? <Pencil size={17}/> : <Plus size={17}/>} {saving ? "Saving…" : editingId ? "Save changes" : "Save billing setup"}</button><button type="button" className="btn secondary" disabled={saving} onClick={()=>setOpen(false)}>Cancel</button>{returnTo && <a className="btn secondary" href={returnTo}>Return</a>}</div>
    </form></dialog>
    <section className={`card table-wrap ${styles.list}`}><table className="table">
      <thead><tr><th>Client</th><th>Payer</th><th>Day rate</th><th>PO/REF</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{filteredProfiles.map(profile => <tr key={profile.id}>
        <td>{students.find(student => student.id === profile.studentId)?.displayName || "Unknown client"}</td><td>{profile.payerName}<small className="muted" style={{ display: "block" }}>{profile.payerType}</small></td>
        <td>£{Number(profile.chargeRules[0]?.rate || 0).toFixed(2)}</td><td>{profile.purchaseOrderNumber?.trim() || "Not supplied"}</td>
        <td><span className={`badge ${profile.activeTo ? "badge-neutral" : "badge-success"}`}>{profile.activeTo ? `Ended ${new Date(profile.activeTo).toLocaleDateString("en-GB")}` : "Active"}</span></td>
        <td><div className="table-actions"><button className="btn ghost" onClick={() => edit(profile)}><Pencil size={16}/>Edit</button>{!profile.activeTo && <button className="btn secondary" onClick={() => end(profile)}><Square size={15}/>End</button>}<button className="btn danger" onClick={() => remove(profile)}><Trash2 size={16}/>Delete</button></div></td>
      </tr>)}</tbody>
    </table>{!loading&&!filteredProfiles.length && <div className="empty"><b>{search?"No matching profiles":"No billing profiles yet"}</b><p>{search?"Try a different client name, payer or reference.":"Choose Add New to set up a client’s billing."}</p></div>}</section>
  </div>;
}
