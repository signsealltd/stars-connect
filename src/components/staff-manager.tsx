/* eslint-disable @next/next/no-img-element */
"use client";
import{appConfirm}from"@/lib/app-dialog";

import { useCallback, useEffect, useState } from "react";
import { Archive, KeyRound, Pencil, Plus, RotateCcw, Search } from "lucide-react";

type Staff = {
  id: string; firstName: string; lastName: string; displayName: string; email: string;
  phone?: string; jobRole: string; active: boolean; clockingEnabled: boolean; cameraRequired: boolean;
  startDate: string; endDate?: string; notes?: string; pinEnabled: boolean;
  payrollNumber?: string; contractedWeeklyHours?: number; hourlyRate?: number; overtimeHourlyRate?: number; profilePhotoUrl?: string;
};

const blank = {
  firstName: "", lastName: "", displayName: "", email: "", phone: "", jobRole: "",
  startDate: "", endDate: "", notes: "", clockingEnabled: true, cameraRequired: false, pin: "",
  payrollNumber: "", contractedWeeklyHours: "", hourlyRate: "", overtimeHourlyRate: "", profilePhotoUrl: "",
};

async function compressStaffPhoto(file:File){if(file.size>12*1024*1024)throw new Error("Choose an image smaller than 12 MB.");const bitmap=await createImageBitmap(file),size=320,canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;const context=canvas.getContext("2d")!;const scale=Math.max(size/bitmap.width,size/bitmap.height),width=bitmap.width*scale,height=bitmap.height*scale;context.drawImage(bitmap,(size-width)/2,(size-height)/2,width,height);bitmap.close();const value=canvas.toDataURL("image/jpeg",0.72);if(value.length>250000)throw new Error("The compressed photograph is still too large. Choose a simpler image.");return value}

export function StaffManager() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState<Staff | null | "new">(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/staff?status=${status}&search=${encodeURIComponent(search)}`);
    if (res.status === 403) { location.href = "/login"; return; }
    setRows(res.ok ? await res.json() : []);
    setLoading(false);
  }, [search, status]);

  useEffect(() => { const id = setTimeout(load, 200); return () => clearTimeout(id); }, [load]);

  function open(row?: Staff) {
    setError("");
    setEditing(row || "new");
    setForm(row ? {
      firstName: row.firstName, lastName: row.lastName, displayName: row.displayName,
      email: row.email, phone: row.phone || "", jobRole: row.jobRole,
      startDate: row.startDate.slice(0, 10), endDate: row.endDate?.slice(0, 10) || "",
      notes: row.notes || "", clockingEnabled: row.clockingEnabled, cameraRequired: row.cameraRequired, pin: "",
      payrollNumber: row.payrollNumber || "", contractedWeeklyHours: row.contractedWeeklyHours?.toString() || "", hourlyRate: row.hourlyRate?.toString() || "", overtimeHourlyRate: row.overtimeHourlyRate?.toString() || "", profilePhotoUrl: row.profilePhotoUrl || "",
    } : blank);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const payload = { ...form, pin: form.pin || undefined, payrollNumber: form.payrollNumber || null, contractedWeeklyHours: form.contractedWeeklyHours === "" ? null : Number(form.contractedWeeklyHours), hourlyRate: form.hourlyRate === "" ? null : Number(form.hourlyRate), overtimeHourlyRate: form.overtimeHourlyRate === "" ? null : Number(form.overtimeHourlyRate) };
    const isNew = editing === "new";
    const res = await fetch(isNew ? "/api/staff" : `/api/staff/${(editing as Staff).id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { setError((await res.json()).error || "Unable to save staff member."); return; }
    setEditing(null);
    await load();
  }

  async function setActive(row: Staff, active: boolean) {
    if (!await appConfirm(`${active ? "Restore" : "Archive"} ${row.displayName}? Historic clock records will be preserved.`)) return;
    await fetch(`/api/staff/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active }) });
    await load();
  }

  return <>
    <div className="toolbar">
      <label style={{ position: "relative" }}><Search size={18} style={{ position: "absolute", left: 13, top: 16 }} />
        <input autoComplete="off" className="field" style={{ paddingLeft: 40 }} placeholder="Search staff" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="active">Active staff</option><option value="archived">Archived staff</option><option value="all">All staff</option>
      </select>
      <button className="btn primary" style={{ marginLeft: "auto" }} onClick={() => open()}><Plus size={18} /> Add staff</button>
    </div>
    <section className="card table-wrap">
      {loading ? <div className="empty"><span className="spinner" /> Loading staffâ€¦</div> :
      rows.length ? <table className="table"><thead><tr><th>Name</th><th>Job title</th><th>Email</th><th>Clocking</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <td><div style={{display:"flex",alignItems:"center",gap:10}}>{row.profilePhotoUrl?<img src={row.profilePhotoUrl} alt="" style={{width:48,height:48,borderRadius:"50%",objectFit:"cover"}}/>:<span className="badge badge-neutral" style={{width:48,height:48,justifyContent:"center"}}>{row.firstName[0]}{row.lastName[0]}</span>}<div><b>{row.displayName}</b><div className="muted">{row.firstName} {row.lastName}</div></div></div></td>
          <td>{row.jobRole}</td><td>{row.email}</td>
          <td><span className={`badge ${row.clockingEnabled && row.pinEnabled ? "badge-success" : "badge-warning"}`}>{row.clockingEnabled ? (row.pinEnabled ? "PIN enabled" : "PIN needed") : "Disabled"}</span></td>
          <td><span className={`badge ${row.active ? "badge-success" : "badge-neutral"}`}>{row.active ? "Active" : "Archived"}</span></td>
          <td><div style={{ display: "flex", gap: 7 }}>
            <button className="btn ghost" onClick={() => open(row)} aria-label={`Edit ${row.displayName}`}><Pencil size={17} /></button>
            <button className={`btn ${row.active ? "danger" : "secondary"}`} onClick={() => setActive(row, !row.active)}>{row.active ? <Archive size={17} /> : <RotateCcw size={17} />}</button>
          </div></td>
        </tr>)}</tbody></table> : <div className="empty"><b>No staff found</b><p>Change the search or status filter, or add a staff member.</p></div>}
    </section>
    {editing && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editing === "new" ? "Add staff" : "Edit staff"}>
      <form autoComplete="off" className="modal" onSubmit={save}>
        <h2 style={{ marginTop: 0 }}>{editing === "new" ? "Add staff member" : `Edit ${(editing as Staff).displayName}`}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid" style={{ marginTop: 16 }}>
          <label className="form-label">First name<input autoComplete="off" className="field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></label>
          <label className="form-label">Surname<input autoComplete="off" className="field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></label>
          <label className="form-label">Display name<input autoComplete="off" className="field" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required /></label>
          <label className="form-label">Job title<input autoComplete="off" className="field" value={form.jobRole} onChange={(e) => setForm({ ...form, jobRole: e.target.value })} required /></label>
          <label className="form-label">Email<input autoComplete="off" className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label className="form-label">Phone<input autoComplete="off" className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label className="form-label full">Staff photograph<input autoComplete="off" className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;try{setForm({...form,profilePhotoUrl:await compressStaffPhoto(file)})}catch(error){setError(error instanceof Error?error.message:"Unable to process photograph.")}}}/><small className="muted">Automatically cropped and compressed to a 320 × 320 JPEG for proportionate storage.</small>{form.profilePhotoUrl&&<div style={{display:"flex",alignItems:"center",gap:12,marginTop:8}}><img src={form.profilePhotoUrl} alt="Staff preview" style={{width:80,height:80,borderRadius:"50%",objectFit:"cover"}}/><button type="button" className="btn secondary" onClick={()=>setForm({...form,profilePhotoUrl:""})}>Remove photograph</button></div>}</label>
          <label className="form-label">Start date<input autoComplete="off" className="field" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></label>
          <label className="form-label">End date<input autoComplete="off" className="field" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
          <label className="form-label">Payroll number<input className="field" autoComplete="off" value={form.payrollNumber} onChange={(e) => setForm({ ...form, payrollNumber: e.target.value })} /></label>
          <label className="form-label">Contracted hours per week<input autoComplete="off" className="field" type="number" min="0" max="168" step="0.25" value={form.contractedWeeklyHours} onChange={(e) => setForm({ ...form, contractedWeeklyHours: e.target.value })} /></label>
          <label className="form-label">Standard hourly rate (£)<input autoComplete="off" className="field" type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} /></label><label className="form-label">Overtime hourly rate (£)<input autoComplete="off" className="field" type="number" min="0" step="0.01" value={form.overtimeHourlyRate} onChange={(e) => setForm({ ...form, overtimeHourlyRate: e.target.value })} /><small className="muted">Leave blank to use the standard hourly rate.</small></label>
          <label className="form-label full"><span><KeyRound size={16} /> {editing === "new" ? "Initial PIN" : "Reset PIN"}</span><input autoComplete="off" name="staff-pin-entry" data-lpignore="true" data-1p-ignore="true" className="field pin-entry-secure" type="text" inputMode="numeric" pattern="\d{4,8}" placeholder={editing === "new" ? "4â€“8 digits (optional)" : "Leave blank to keep current PIN"} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></label>
          <label className="form-label full">Restricted manager notes<textarea autoComplete="off" className="field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <label className="full"><input autoComplete="off" type="checkbox" checked={form.clockingEnabled} onChange={(e) => setForm({ ...form, clockingEnabled: e.target.checked })} /> Allow this staff member to clock in and out</label><label className="full"><input autoComplete="off" type="checkbox" checked={form.cameraRequired} onChange={(e) => setForm({ ...form, cameraRequired: e.target.checked })} /> Require a front-camera confirmation when camera mode is “Required for selected staff”</label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
          <button type="button" className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn primary">Save staff member</button>
        </div>
      </form>
    </div>}
  </>;
}


