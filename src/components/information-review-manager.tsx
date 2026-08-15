"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardCopy, FilePlus2, Mail, MessageSquareText, RefreshCw } from "lucide-react";

type Student={id:string;displayName:string;internalReference?:string};
type Review={id:string;status:string;source:string;expiresAt:string;student:Student;_count:{proposals:number}};

export function InformationReviewManager(){
  const [students,setStudents]=useState<Student[]>([]),[reviews,setReviews]=useState<Review[]>([]);
  const [studentId,setStudentId]=useState(""),[verify,setVerify]=useState(false),[source,setSource]=useState("ONLINE");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[link,setLink]=useState("");
  const load=useCallback(async()=>{
    const [reviewsResponse,studentsResponse]=await Promise.all([
      fetch("/api/information-reviews",{cache:"no-store"}),
      fetch("/api/students/records?status=active",{cache:"no-store"}),
    ]);
    if(reviewsResponse.ok)setReviews(await reviewsResponse.json());
    if(studentsResponse.ok)setStudents(await studentsResponse.json());
  },[]);
  useEffect(()=>{void load()},[load]);
  async function create(){
    setBusy(true);setError("");setLink("");
    const response=await fetch("/api/information-reviews",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({studentId,verifyDateOfBirth:verify,source,expiryDays:21})});
    const body=await response.json();
    if(response.ok){setLink(body.link);setStudentId("");await load()}else setError(body.error||"The review could not be created.");
    setBusy(false);
  }
  const message=link?`STARS has asked you to securely review and update the information it holds. This private link expires and can be used once: ${link}`:"";
  return <>
    <section className="card" style={{padding:22}}>
      <div className="page-head"><div><h2>Start a review</h2><p className="muted">The secure link is shown once. Copy or send it before leaving this confirmation.</p></div></div>
      <div className="form-grid">
        <label>Student<select className="field" value={studentId} onChange={event=>setStudentId(event.target.value)}><option value="">Choose a student</option>{students.map(student=><option key={student.id} value={student.id}>{student.displayName}{student.internalReference?` · ${student.internalReference}`:""}</option>)}</select></label>
        <label>Source<select className="field" value={source} onChange={event=>setSource(event.target.value)}><option value="ONLINE">Online form</option><option value="PAPER">Paper form entered by staff</option><option value="ASSISTED">Staff-assisted review</option></select></label>
        <label className="check-row"><input type="checkbox" checked={verify} onChange={event=>setVerify(event.target.checked)}/>Require date-of-birth verification</label>
        <button className="btn primary" disabled={!studentId||busy} onClick={()=>void create()}><FilePlus2/>{busy?"Creating…":"Create secure review"}</button>
      </div>
      {error&&<div className="alert alert-error">{error}</div>}
      {link&&<div className="alert alert-warning" style={{display:"grid",gap:10}}><b>Copy or send this one-time link now</b><code style={{overflowWrap:"anywhere"}}>{link}</code><div className="table-actions"><button className="btn secondary" onClick={()=>navigator.clipboard.writeText(link)}><ClipboardCopy/>Copy link</button><button className="btn secondary" onClick={()=>navigator.clipboard.writeText(message)}><MessageSquareText/>Copy SMS text</button><a className="btn secondary" href={`mailto:?subject=${encodeURIComponent("STARS annual information review")}&body=${encodeURIComponent(message)}`}><Mail/>Open email</a></div><small>The message contains no medical details or form answers. Provider-backed SMS sending is not enabled.</small></div>}
    </section>
    <section className="card table-wrap" style={{marginTop:18}}>{reviews.length?<table className="table"><thead><tr><th>Student</th><th>Status</th><th>Source</th><th>Expires</th><th>Changes</th><th></th></tr></thead><tbody>{reviews.map(review=><tr key={review.id}><td><b>{review.student.displayName}</b><small className="muted" style={{display:"block"}}>{review.student.internalReference||"No reference"}</small></td><td><span className={`badge ${review.status==="COMPLETED"?"badge-success":["SUBMITTED","UNDER_REVIEW","PARTIALLY_APPROVED"].includes(review.status)?"badge-warning":review.status==="REVOKED"||review.status==="EXPIRED"?"badge-danger":"badge-neutral"}`}>{review.status.replaceAll("_"," ")}</span></td><td>{review.source}</td><td>{new Date(review.expiresAt).toLocaleDateString("en-GB")}</td><td>{review._count.proposals}</td><td><Link className="btn secondary" href={`/dashboard/information-reviews/${review.id}`}>Open</Link></td></tr>)}</tbody></table>:<div className="empty"><RefreshCw/>No information reviews have been created.</div>}</section>
  </>;
}
