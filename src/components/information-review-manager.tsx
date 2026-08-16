"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardCopy, Eye, FilePlus2, Mail, MessageSquareText, RefreshCw, Trash2 } from "lucide-react";

type Student = { id: string; displayName: string; internalReference?: string };
type Review = { id: string; status: string; source: string; expiresAt: string; student: Student; _count: { proposals: number } };

export function InformationReviewManager() {
  const [students, setStudents] = useState<Student[]>([]), [reviews, setReviews] = useState<Review[]>([]);
  const [studentId, setStudentId] = useState(""), [verify, setVerify] = useState(false), [source, setSource] = useState("ONLINE");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [link, setLink] = useState("");
  const [deleteReview, setDeleteReview] = useState<Review | null>(null), [deletePassword, setDeletePassword] = useState("");
  const load = useCallback(async () => {
    const [reviewsResponse, studentsResponse] = await Promise.all([
      fetch("/api/information-reviews", { cache: "no-store" }),
      fetch("/api/students/records?status=active", { cache: "no-store" }),
    ]);
    if (reviewsResponse.ok) setReviews(await reviewsResponse.json());
    if (studentsResponse.ok) setStudents(await studentsResponse.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    setBusy(true); setError(""); setLink("");
    const response = await fetch("/api/information-reviews", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId, verifyDateOfBirth: verify, source, expiryDays: 21 }),
    });
    const body = await response.json();
    if (response.ok) { setLink(body.link); setStudentId(""); await load(); }
    else setError(body.error || "The review could not be created.");
    setBusy(false);
  }

  async function removeCompleted(event: React.FormEvent) {
    event.preventDefault();
    if (!deleteReview) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/information-reviews/${deleteReview.id}`, {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: deletePassword }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) { setDeleteReview(null); setDeletePassword(""); await load(); }
    else setError(body.error || "The review request could not be removed.");
    setBusy(false);
  }

  const message = link ? `STARS has asked you to securely review and update the information it holds. This private link expires and can be used once: ${link}` : "";
  return <>
    <section className="card" style={{ padding: 22 }}>
      <div className="page-head"><div><h2>Start a review</h2><p className="muted">The secure link is shown once. Copy or send it before leaving this confirmation.</p></div><Link className="btn secondary" href="/dashboard/information-reviews/preview" target="_blank"><Eye/>Preview records request</Link></div>
      <div className="form-grid">
        <label>Student<select className="field" value={studentId} onChange={event => setStudentId(event.target.value)}><option value="">Choose a student</option>{students.map(student => <option key={student.id} value={student.id}>{student.displayName}{student.internalReference ? ` - ${student.internalReference}` : ""}</option>)}</select></label>
        <label>Source<select className="field" value={source} onChange={event => setSource(event.target.value)}><option value="ONLINE">Online form</option><option value="PAPER">Paper form entered by staff</option><option value="ASSISTED">Staff-assisted review</option></select></label>
        <label className="check-row"><input type="checkbox" checked={verify} onChange={event => setVerify(event.target.checked)}/>Require date-of-birth verification</label>
        <button className="btn primary" disabled={!studentId || busy} onClick={() => void create()}><FilePlus2/>{busy ? "Creating..." : "Create secure review"}</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {link && <div className="alert alert-warning review-link-confirmation"><b>Copy, preview or send this one-time link now</b><code>{link}</code><div className="table-actions"><a className="btn primary" href={link} target="_blank" rel="noreferrer"><Eye/>Open test link</a><button className="btn secondary" onClick={() => navigator.clipboard.writeText(link)}><ClipboardCopy/>Copy link</button><button className="btn secondary" onClick={() => navigator.clipboard.writeText(message)}><MessageSquareText/>Copy SMS text</button><a className="btn secondary" href={`mailto:?subject=${encodeURIComponent("STARS annual information review")}&body=${encodeURIComponent(message)}`}><Mail/>Open email</a></div><small>The message contains no medical details or form answers. Opening the link is a live test of that request.</small></div>}
    </section>
    <section className="card table-wrap" style={{ marginTop: 18 }}>{reviews.length ? <table className="table"><thead><tr><th>Student</th><th>Status</th><th>Source</th><th>Expires</th><th>Changes</th><th>Actions</th></tr></thead><tbody>{reviews.map(review => <tr key={review.id}><td><b>{review.student.displayName}</b><small className="muted" style={{ display: "block" }}>{review.student.internalReference || "No reference"}</small></td><td><span className={`badge ${review.status === "COMPLETED" ? "badge-success" : ["SUBMITTED", "UNDER_REVIEW", "PARTIALLY_APPROVED"].includes(review.status) ? "badge-warning" : review.status === "REVOKED" || review.status === "EXPIRED" ? "badge-danger" : "badge-neutral"}`}>{review.status.replaceAll("_", " ")}</span></td><td>{review.source}</td><td>{new Date(review.expiresAt).toLocaleDateString("en-GB")}</td><td>{review._count.proposals}</td><td><div className="table-actions"><Link className="btn secondary" href={`/dashboard/information-reviews/${review.id}`}>Open</Link><button className="btn danger" onClick={() => { setDeleteReview(review); setDeletePassword(""); setError(""); }}><Trash2/>{review.status === "COMPLETED" ? "Delete test" : "Cancel request"}</button></div></td></tr>)}</tbody></table> : <div className="empty"><RefreshCw/>No information reviews have been created.</div>}</section>
    {deleteReview && <div className="modal-backdrop"><form className="modal" onSubmit={removeCompleted}><h2>{deleteReview.status === "COMPLETED" ? "Delete completed review?" : "Cancel and delete this request?"}</h2><p>{deleteReview.status === "COMPLETED" ? <>This removes the submitted form, proposals and request history for <b>{deleteReview.student.displayName}</b>. It does not reverse information already accepted into the student profile.</> : <>This permanently removes the incomplete request for <b>{deleteReview.student.displayName}</b> and immediately makes its secure public link unusable. It does not alter the student&apos;s live profile.</>} The action remains in the audit log.</p><label className="form-label">Enter your password to confirm<input className="field" type="password" autoComplete="current-password" required value={deletePassword} onChange={event => setDeletePassword(event.target.value)}/></label><div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setDeleteReview(null)}>Keep request</button><button className="btn danger" disabled={busy || !deletePassword}>{busy ? "Deleting..." : deleteReview.status === "COMPLETED" ? "Delete completed test" : "Cancel and delete request"}</button></div></form></div>}
  </>;
}
