"use client";

import { useState } from "react";

type Props = {
  staff: { id: string; displayName: string }[];
  courses: { id: string; name: string }[];
  matrix: { rows: { id: string; cells: { courseId: string; assignment?: boolean|null; assignmentReason?: string }[] }[] } | null;
  reload: () => Promise<void>;
};

export default function StaffAssignments({staff,courses,matrix,reload}:Props) {
  const [staffId,setStaffId]=useState("");
  const [courseId,setCourseId]=useState("");
  const [required,setRequired]=useState("default");
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  function select(personId:string,selectedCourseId:string) {
    setStaffId(personId);setCourseId(selectedCourseId);
    const cell=matrix?.rows.find(row=>row.id===personId)?.cells.find(cell=>cell.courseId===selectedCourseId);
    setRequired(cell?.assignment==null?"default":cell.assignment?"required":"exempt");
    setReason(cell?.assignmentReason||"");
  }
  return <details className="card" style={{marginBottom:20,padding:20}}><summary>Assign training to a staff member</summary><p className="muted">Use this for responsibilities, client needs, relevant new starters or an individual exemption. Existing completion evidence is unchanged.</p><form className="form-grid" onSubmit={async event=>{
    event.preventDefault();setBusy(true);setError("");
    try {
      const response=await fetch("/api/training/assignments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({staffId,courseId,required:required==="default"?null:required==="required",reason})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to save assignment.");
      await reload();
    }catch(error){setError(error instanceof Error?error.message:"Unable to save assignment.");}
    finally{setBusy(false);}
  }}><label>Staff member<select className="field" required value={staffId} onChange={e=>select(e.target.value,courseId)}><option value="">Select staff</option>{staff.map(s=><option key={s.id} value={s.id}>{s.displayName}</option>)}</select></label><label>Course<select className="field" required value={courseId} onChange={e=>select(staffId,e.target.value)}><option value="">Select course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Individual requirement<select className="field" value={required} onChange={e=>setRequired(e.target.value)}><option value="default">Use role requirement</option><option value="required">Required for this staff member</option><option value="exempt">Not required for this staff member</option></select></label><label>Reason<input className="field" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>{error&&<p role="alert" className="alert alert-error">{error}</p>}<button className="btn primary" disabled={busy}>{busy?"Saving…":"Save assignment"}</button></form></details>;
}
