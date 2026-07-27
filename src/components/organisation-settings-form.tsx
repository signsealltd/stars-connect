/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

type Settings = {
  organisationName: string; organisationLegalName: string; organisationAddress: string;
  organisationRegistrationNumber: string; organisationLogoUrl: string;
  themePrimary: string; themePrimaryDark: string; themeAccent: string;
};

async function compressLogo(file: File) {
  if (file.size > 12 * 1024 * 1024) throw new Error("Choose a logo smaller than 12 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 700 / bitmap.width, 300 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

export function OrganisationSettingsForm() {
  const [form, setForm] = useState<Settings>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/settings/organisation").then((r) => r.json()).then(setForm).catch(() => setError("Organisation settings could not be loaded.")); }, []);
  if (!form) return <section className="card empty">{error || "Loading organisation settings…"}</section>;
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    const response = await fetch("/api/settings/organisation", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok) return setError(result.error || "Organisation settings could not be saved.");
    setNotice("Organisation and theme settings saved. Refreshing the page will apply the branding everywhere.");
    window.dispatchEvent(new CustomEvent("stars-branding", { detail: result }));
  }
  return <form className="card form-grid" style={{ padding: 24, marginBottom: 22 }} onSubmit={save} autoComplete="off">
    <div className="full"><h2>Organisation and appearance</h2><p className="muted">Purple remains the default. Custom colours apply throughout manager and kiosk screens.</p></div>
    <label className="form-label">Display name<input className="field" value={form.organisationName} onChange={(e) => setForm({ ...form, organisationName: e.target.value })}/></label>
    <label className="form-label">Legal/company name<input className="field" value={form.organisationLegalName} onChange={(e) => setForm({ ...form, organisationLegalName: e.target.value })}/></label>
    <label className="form-label">Registration number<input className="field" value={form.organisationRegistrationNumber} onChange={(e) => setForm({ ...form, organisationRegistrationNumber: e.target.value })}/></label>
    <label className="form-label full">Address<textarea className="field" value={form.organisationAddress} onChange={(e) => setForm({ ...form, organisationAddress: e.target.value })}/></label>
    <label className="form-label full">Organisation logo<input className="field" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={async(e) => { const file=e.target.files?.[0]; if(file) setForm({...form,organisationLogoUrl:await compressLogo(file)}); }}/>{form.organisationLogoUrl&&<img src={form.organisationLogoUrl} alt="Organisation logo preview" style={{maxWidth:180,maxHeight:90,objectFit:"contain",marginTop:10}}/>}</label>
    {[["themePrimary","Primary colour"],["themePrimaryDark","Header colour"],["themeAccent","Accent colour"]].map(([key,label])=><label className="form-label" key={key}>{label}<input className="field" type="color" value={form[key as keyof Settings]} onChange={(e)=>setForm({...form,[key]:e.target.value})}/></label>)}
    <div className="full"><button type="button" className="btn secondary" onClick={()=>setForm({...form,themePrimary:"#82368c",themePrimaryDark:"#54205d",themeAccent:"#27778b"})}>Restore purple theme</button></div>
    {error&&<div className="alert alert-error full">{error}</div>}{notice&&<div className="alert alert-success full">{notice}</div>}
    <div className="full"><button className="btn primary"><Save size={17}/>Save organisation settings</button></div>
  </form>;
}
