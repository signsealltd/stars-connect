"use client";

import { useState } from "react";

type Row = {
  id: string;
  name: string;
  minutes: number;
  missingClockOut: boolean;
  openClockInAt?: string;
  transportDuty?: boolean;
};
type Action = "clock-in" | "clock-out";

export function TimesheetManager({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [editing, setEditing] = useState<Row>();
  const [action, setAction] = useState<Action>("clock-out");
  const [eventAt, setEventAt] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function open(row: Row, nextAction: Action) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setEventAt(now.toISOString().slice(0, 16));
    setAction(nextAction);
    setReason("");
    setError("");
    setEditing(row);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    const endpoint = action === "clock-in" ? "/api/timesheets/clock-in" : "/api/timesheets/clock-out";
    const timestampKey = action === "clock-in" ? "clockInAt" : "clockOutAt";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        staffId: editing.id,
        [timestampKey]: new Date(eventAt).toISOString(),
        reason,
      }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error || `The ${action.replace("-", " ")} could not be recorded.`);
      return;
    }
    if (action === "clock-in") {
      setRows(current => current.map(row => row.id === editing.id
        ? { ...row, missingClockOut: true, openClockInAt: body.clockInAt }
        : row));
      setNotice(`${editing.name} was clocked in. The manual entry is marked for review and has been audited.`);
      setEditing(undefined);
      return;
    }
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
          <b>{row.transportDuty ? "🚌 " : ""}{row.name}</b>
          <span>{Math.floor(row.minutes / 60)}h {row.minutes % 60}m</span>
          <span style={{ color: row.missingClockOut ? "#b53b3b" : "#177e59" }}>
            {row.missingClockOut ? "Currently clocked in" : "Not clocked in"}
          </span>
          <span>
            <button
              className="btn secondary"
              onClick={() => open(row, row.missingClockOut ? "clock-out" : "clock-in")}
            >
              {row.missingClockOut ? "Clock out staff" : "Clock in staff"}
            </button>
          </span>
        </div>,
      ) : <div className="empty"><b>No timesheet data</b><p>Clocking activity will appear here.</p></div>}
    </section>
    {editing && <div className="modal-backdrop">
      <form className="modal" onSubmit={save} autoComplete="off">
        <h2>{action === "clock-in" ? "Clock in" : "Clock out"} {editing.name}</h2>
        <p className="muted">
          Use the time they actually {action === "clock-in" ? "started" : "finished"}.
          This creates a reviewable, audited manager entry and does not alter earlier clock events.
        </p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <label className="form-label">{action === "clock-in" ? "Clock-in" : "Clock-out"} date and time
          <input
            className="field"
            type="datetime-local"
            required
            value={eventAt}
            onChange={event => setEventAt(event.target.value)}
          />
        </label>
        <label className="form-label">Reason
          <textarea
            className="field"
            required
            minLength={5}
            maxLength={1000}
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder={`For example: Staff member forgot to clock ${action === "clock-in" ? "in" : "out"}`}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={() => setEditing(undefined)} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : `Record clock-${action === "clock-in" ? "in" : "out"}`}
          </button>
        </div>
      </form>
    </div>}
  </>;
}
