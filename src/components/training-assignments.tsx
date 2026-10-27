"use client";

import type {AssignmentPolicy} from "@/lib/training-status";
import { useState } from "react";

type Props = {
  staff: { id: string; displayName: string }[];
  courses: { id: string; name: string }[];
  matrix: { rows: { id: string; cells: { courseId: string; assignment?: boolean|null; assignmentPolicy?:AssignmentPolicy; assignmentReason?: string }[] }[] } | null;
  reload: () => Promise<void>;
  initialStaffId?:string;
  initialCourseId?:string;
};

export default function StaffAssignments({staff,courses,matrix,reload,initialStaffId="",initialCourseId=""}:Props) {
  const initialCell=matrix?.rows.find(row=>row.id===initialStaffId)?.cells.find(cell=>cell.courseId===initialCourseId);
  const [staffId,setStaffId]=useState(initialStaffId);
  const [courseId,setCourseId]=useState(initialCourseId);
  const [required,setRequired]=useState(initialCell?.assignment==null?"default":initialCell.assignment?"required":"exempt");
  const [reason,setReason]=useState(initialCell?.assignmentReason||"");
  const [policy,setPolicy]=useState<AssignmentPolicy>(initialCell?.assignmentPolicy||{});
  const [plans,setPlans]=useState((initialCell?.assignmentPolicy?.clientPlans||[]).map(p=>[p.clientId,p.planId,p.version].join(" | ")).join("\n"));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  function select(personId:string,selectedCourseId:string) {
    setStaffId(personId);setCourseId(selectedCourseId);
    const cell=matrix?.rows.find(row=>row.id===personId)?.cells.find(cell=>cell.courseId===selectedCourseId);
    setRequired(cell?.assignment==null?"default":cell.assignment?"required":"exempt");
    setReason(cell?.assignmentReason||"");setPolicy(cell?.assignmentPolicy||{});setPlans((cell?.assignmentPolicy?.clientPlans||[]).map(p=>[p.clientId,p.planId,p.version].join(" | ")).join("\n"));
  }
  return <details open={initialStaffId?true:undefined} className="card" style={{marginBottom:20,padding:20}}><summary>Assign training to a staff member</summary><p className="muted">Use this for responsibilities, client needs, relevant new starters or an individual exemption. Existing completion evidence is unchanged.</p><form className="form-grid" onSubmit={async event=>{
    event.preventDefault();setBusy(true);setError("");
    try {
      const response=await fetch("/api/training/assignments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({staffId,courseId,required:required==="default"?null:required==="required",reason,policy:{...policy,clientPlans:plans.trim()?plans.split(/\n/).filter(Boolean).map(line=>{const [clientId,planId,version]=line.split("|").map(s=>s.trim());return {clientId,planId,version};}):[]}})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to save assignment.");
      await reload();
    }catch(error){setError(error instanceof Error?error.message:"Unable to save assignment.");}
    finally{setBusy(false);}
  }}><label>Staff member<select className="field" required value={staffId} onChange={e=>select(e.target.value,courseId)}><option value="">Select staff</option>{staff.map(s=><option key={s.id} value={s.id}>{s.displayName}</option>)}</select></label><label>Course<select className="field" required value={courseId} onChange={e=>select(staffId,e.target.value)}><option value="">Select course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Individual requirement<select className="field" value={required} onChange={e=>{setRequired(e.target.value);if(e.target.value==="default"){setPolicy({});setPlans("");}}}><option value="default">Use role requirement</option><option value="required">Required for this staff member</option><option value="exempt">Not required for this staff member</option></select></label><label>Reason<input className="field" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><fieldset className="full training-fieldset"><legend>Individual renewal, reassessment and booking</legend><p className="muted">Choose an individual requirement above to save these settings. Give a reason for overrides. Booking does not change compliance.</p><label>Override policy interval (months)<input className="field" type="number" min="1" max="120" value={policy.renewalOverrideMonths||""} onChange={e=>setPolicy({...policy,renewalOverrideMonths:e.target.value?Number(e.target.value):undefined})}/></label>{([["renewalOverrideDate","Override renewal date"],["reassessmentAfter","Require new assessment on or after"],["bookedFor","Confirmed booking date"]] as const).map(([key,label])=><label key={key}>{label}<input className="field" type="date" value={policy[key]||""} onChange={e=>setPolicy({...policy,[key]:e.target.value||undefined})}/></label>)}<label className="full">Required client plans — one per line: client reference | plan reference | version<textarea className="field" value={plans} onChange={e=>setPlans(e.target.value)}/></label><p className="muted">For a STARS published plan use its record reference ID; its published version is checked automatically. Update external plan versions here after material changes.</p></fieldset>{error&&<p role="alert" className="alert alert-error">{error}</p>}<button className="btn primary" disabled={busy}>{busy?"Saving…":"Save assignment"}</button></form></details>;
}
