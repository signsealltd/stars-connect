"use client";

import { useState } from "react";

type Row = { id: string; name: string; minutes: number; missingClockOut: boolean; openClockInAt?: string };

export function TimesheetManager({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [editing, setEditing] = useState<Row>();
  const [clockOutAt, setClockOutAt] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function open(row: Row) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setClockOutAt(now.toISOString().slice(0, 16));
    setReason("");
    setError("");
    setEditing(row);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/timesheets/clock-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ staffId: editing.id, clockOutAt: new Date(clockOutAt).toISOString(), reason }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setError(body.error || "The clock-out could not be recorded.");
    const extra = editing.openClockInAt
      ? Math.max(0, Math.round((new Date(body.clockOutAt).getTime() - new Date(editing.openClockInAt).getTime()) / 60000))
      : 0;
    setRows(current => current.map(row => row.id === editing.id
      ? { ...row, minutes: row.minutes + extra, missingClockOut: false, openClockInAt: undefined }
      : row));
    setNotice(`${editing.name} was clocked out. The manual entry is marked for review and has been audited.`);
    setEditing(undefined);
  }

  return <>
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <section className="card">
      {rows.length ? rows.map(row =>
        <div className="register-row timesheet-row" style={{ gridTemplateColumns: "1fr 150px 170px 180px" }} key={row.id}>
          <b>{row.name}</b>
          <span>{Math.floor(row.minutes / 60)}h {row.minutes % 60}m</span>
          <span style={{ color: row.missingClockOut ? "#b53b3b" : "#177e59" }}>{row.missingClockOut ? "Missing clock-out" : "Complete"}</span>
          <span>{row.missingClockOut ? <button className="btn secondary" onClick={() => open(row)}>Clock out staff</button> : "—"}</span>
        </div>,
      ) : <div className="empty"><b>No timesheet data</b><p>Clocking activity will appear here.</p></div>}
    </section>
    {editing && <div className="modal-backdrop">
      <form className="modal" onSubmit={save} autoComplete="off">
        <h2>Clock out {editing.name}</h2>
        <p className="muted">Use the time they actually finished. This creates a reviewable manager entry and does not alter the original clock-in.</p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <label className="form-label">Clock-out date and time
          <input className="field" type="datetime-local" required value={clockOutAt} onChange={event => setClockOutAt(event.target.value)}/>
        </label>
        <label className="form-label">Reason
          <textarea className="field" required minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} placeholder="For example: Staff member forgot to clock out"/>
        </label>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={() => setEditing(undefined)} disabled={busy}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Record clock-out"}</button>
        </div>
      </form>
    </div>}
  </>;
}
