/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Camera, Eye, X } from "lucide-react";

export type ClockingPhotoRow = {
  eventId: string;
  photoId: string | null;
  staffName: string;
  deviceName: string;
  eventType: "CLOCK_IN" | "CLOCK_OUT";
  eventTime: string;
  photoStatus: string;
  expiresAt: string | null;
  retained: boolean;
};

export function ClockingPhotoReview({ rows }: { rows: ClockingPhotoRow[] }) {
  const [selected, setSelected] = useState<ClockingPhotoRow>();
  const [imageError, setImageError] = useState(false);

  function open(row: ClockingPhotoRow) {
    setImageError(false);
    setSelected(row);
  }

  return <>
    <section className="card table-wrap">
      {rows.length ? <table className="table">
        <thead><tr><th>Date and time</th><th>Staff member</th><th>Event</th><th>Device</th><th>Retention</th><th>Photograph</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.eventId}>
          <td>{new Date(row.eventTime).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })}</td>
          <td><b>{row.staffName}</b></td>
          <td><span className={`badge ${row.eventType === "CLOCK_IN" ? "badge-success" : "badge-neutral"}`}>{row.eventType === "CLOCK_IN" ? "Clock in" : "Clock out"}</span></td>
          <td>{row.deviceName}</td>
          <td>{row.expiresAt ? <>
            <span className={`badge ${row.retained ? "badge-success" : "badge-danger"}`}>{row.retained ? "Retained" : "Expired"}</span>
            <small className="muted" style={{ display: "block", marginTop: 4 }}>Until {new Date(row.expiresAt).toLocaleDateString("en-GB")}</small>
          </> : <span className="badge badge-warning">{row.photoStatus.replaceAll("_", " ").toLowerCase()}</span>}</td>
          <td>{row.photoId && row.retained
            ? <button className="btn secondary" type="button" onClick={() => open(row)}><Eye size={17}/>View</button>
            : <span className="muted">Unavailable</span>}</td>
        </tr>)}</tbody>
      </table> : <div className="empty"><Camera size={32}/><b>No clocking photographs match these filters.</b><span>Photographs only appear when camera confirmation is required and successfully captured.</span></div>}
    </section>

    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(undefined); }}>
      <section className="modal photo-review-modal" role="dialog" aria-modal="true" aria-labelledby="photo-review-title">
        <div className="page-head">
          <div><h2 id="photo-review-title">{selected.staffName}</h2><p className="muted">{selected.eventType === "CLOCK_IN" ? "Clock in" : "Clock out"} · {new Date(selected.eventTime).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "full", timeStyle: "short" })} · {selected.deviceName}</p></div>
          <button className="btn ghost" type="button" onClick={() => setSelected(undefined)} aria-label="Close photograph"><X/></button>
        </div>
        {imageError
          ? <div className="alert alert-error">The photograph could not be displayed. It may have expired or been removed.</div>
          : <img className="clocking-photo" src={`/api/attendance-photos/${selected.photoId}`} alt={`Clocking confirmation for ${selected.staffName}`} onError={() => setImageError(true)}/>}
        <p className="muted">Access to this photograph has been recorded in the audit log. Do not copy or share it unless authorised.</p>
      </section>
    </div>}
  </>;
}
