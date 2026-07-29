"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { LAUNCH_CLEANUP_CONFIRMATION } from "@/lib/launch-cleanup";

export function LaunchCleanup() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ready = confirmation.trim().toUpperCase() === LAUNCH_CLEANUP_CONFIRMATION && password.length > 0;

  async function clean() {
    if (!ready || busy) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/system/launch-cleanup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation, password }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Launch cleanup failed.");
      return;
    }
    setConfirmation("");
    setPassword("");
    setOpen(false);
    setMessage(body.summary || "Launch cleanup complete.");
  }

  return <section className="card" style={{ marginTop: 20, borderColor: "var(--danger,#a52a2a)" }}>
    <h2><AlertTriangle size={20}/> Prepare clean launch database</h2>
    <p className="muted">Permanently removes all students, staff, attendance, visitors, devices, finance records, reports, documents, premises records, application settings and audit history. User accounts, password hashes and current login sessions are preserved. Devices must be provisioned again.</p>
    {message && <div className={message.includes("complete") ? "alert alert-success" : "alert alert-error"}>{message}</div>}
    <button className="btn secondary" style={{ color: "var(--danger,#a52a2a)" }} onClick={() => setOpen(true)}>
      <Trash2 size={17}/> Open launch cleanup
    </button>
    {open && <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="launch-cleanup-title">
        <h2 id="launch-cleanup-title">Permanently clear test data?</h2>
        <div className="alert alert-error">Take and verify a database backup first. This action cannot be undone.</div>
        <p>All operational records, files, device registrations and settings will be removed. Only login accounts and sessions remain.</p>
        <label className="form-label">Type <b>{LAUNCH_CLEANUP_CONFIRMATION}</b>
          <input className="field" autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)}/>
        </label>
        <label className="form-label">Administrator password
          <input className="field" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}/>
        </label>
        {message && <div className="alert alert-error">{message}</div>}
        <div className="modal-actions">
          <button className="btn secondary" disabled={busy} onClick={() => { setOpen(false); setMessage(""); }}>Cancel</button>
          <button className="btn primary" style={{ background: "var(--danger,#a52a2a)" }} disabled={!ready || busy} onClick={clean}>
            <Trash2 size={17}/>{busy ? "Clearing…" : "Clear all test data"}
          </button>
        </div>
      </div>
    </div>}
  </section>;
}
