"use client";

import { useEffect, useState } from "react";

type Form = { host: string; port: number; secure: boolean; username: string; password: string; fromName: string; fromEmail: string; clearCredentials: boolean };
const empty: Form = { host: "", port: 587, secure: false, username: "", password: "", fromName: "STARS Connect", fromEmail: "", clearCredentials: false };

export function SmtpConfigurationForm() {
  const [form, setForm] = useState(empty);
  const [usernameConfigured, setUsernameConfigured] = useState(false);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string }>();

  useEffect(() => {
    fetch("/api/email/config", { cache: "no-store" }).then(response => response.json()).then(config => {
      setForm({ host: config.host === "Not configured" ? "" : config.host, port: config.port || 587, secure: config.secure, username: "", password: "", fromName: config.fromName || "STARS Connect", fromEmail: config.fromEmail || "", clearCredentials: false });
      setUsernameConfigured(config.usernameConfigured);
      setPasswordConfigured(config.passwordConfigured);
    });
  }, []);

  function setEncryption(value: string) {
    if (value === "implicit") setForm({ ...form, secure: true, port: 465 });
    else if (value === "starttls") setForm({ ...form, secure: false, port: 587 });
    else setForm({ ...form, secure: false, port: 25 });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(undefined);
    try {
      const response = await fetch("/api/email/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "SMTP settings could not be saved.");
      setNotice({ ok: true, text: "SMTP settings saved. Run \"Check connection\" below before sending a test email." });
      setUsernameConfigured(!form.clearCredentials && (usernameConfigured || Boolean(form.username)));
      setPasswordConfigured(!form.clearCredentials && (passwordConfigured || Boolean(form.password)));
      setForm({ ...form, username: "", password: "", clearCredentials: false });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "SMTP settings could not be saved." });
    } finally { setBusy(false); }
  }

  const gmailMismatch = form.username.toLowerCase().endsWith("@gmail.com") && form.host && form.host !== "smtp.gmail.com";
  return <form autoComplete="off" className="card" style={{ padding: 22 }} onSubmit={save}>
    <h2 style={{ marginTop: 0 }}>SMTP server setup</h2>
    <p className="muted">Use the details supplied by your email provider. For most providers, choose STARTTLS on port 587. Implicit TLS normally uses port 465.</p>
    {notice && <div className={`alert ${notice.ok ? "alert-success" : "alert-error"}`}>{notice.text}</div>}
    {gmailMismatch && <div className="alert alert-warning">A Gmail username normally requires host <b>smtp.gmail.com</b> and a Google app password.</div>}
    <div className="form-grid">
      <label className="form-label">Email provider<select className="field" defaultValue="custom" onChange={event=>{if(event.target.value==="gmail")setForm({...form,host:"smtp.gmail.com",port:587,secure:false});else if(event.target.value==="microsoft")setForm({...form,host:"smtp.office365.com",port:587,secure:false})}}><option value="custom">Custom / current settings</option><option value="gmail">Google Gmail / Workspace</option><option value="microsoft">Microsoft 365 / Outlook</option></select></label>
      <label className="form-label">SMTP host<input autoComplete="off" className="field" required placeholder="For example: smtp.office365.com" value={form.host} onChange={event => setForm({ ...form, host: event.target.value.trim() })}/></label>
      <label className="form-label">Encryption<select className="field" value={form.secure ? "implicit" : form.port === 25 ? "none" : "starttls"} onChange={event => setEncryption(event.target.value)}><option value="starttls">STARTTLS (recommended, port 587)</option><option value="implicit">Implicit TLS (port 465)</option><option value="none">None / provider controlled</option></select></label>
      <label className="form-label">Port<input autoComplete="off" className="field" type="number" min={1} max={65535} required value={form.port} onChange={event => setForm({ ...form, port: Number(event.target.value) })}/></label>
      <label className="form-label">SMTP username<input autoComplete="off" className="field" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} placeholder={usernameConfigured ? "Leave blank to keep saved username" : "Usually the complete email address"}/></label>
      <label className="form-label">SMTP password<input autoComplete="new-password" className="field" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder={passwordConfigured ? "Leave blank to keep saved password" : "Mailbox or app password"}/></label>
      <label className="form-label">Sender name<input autoComplete="off" className="field" required value={form.fromName} onChange={event => setForm({ ...form, fromName: event.target.value })}/></label>
      <label className="form-label">Sender email<input autoComplete="off" className="field" type="email" required value={form.fromEmail} onChange={event => setForm({ ...form, fromEmail: event.target.value })}/><small className="muted">Many providers require this to match the authenticated mailbox.</small></label>
      <label className="check-row"><input type="checkbox" checked={form.clearCredentials} onChange={event => setForm({ ...form, clearCredentials: event.target.checked })}/><span>Remove the saved username and password</span></label>
    </div>
    <button className="btn primary" disabled={busy}>{busy ? "Saving..." : "Save SMTP settings"}</button>
  </form>;
}

