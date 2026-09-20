"use client";
import {useRef,useState} from "react";
import styles from "./dashboard-notes.module.css";
type Charge={id:string;studentName:string;fundedDays?:string|number|null;removedDays?:string|number;bankHolidayDays?:number;quantity:string|number};
export function FundedDayEditor({runId,charge,disabled,onSaved}:{runId:string;charge:Charge;disabled:boolean;onSaved:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[days,setDays]=useState(""),[removed,setRemoved]=useState("0"),[reason,setReason]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 return <><button className="btn primary" disabled={disabled} onClick={()=>{setDays(charge.fundedDays==null?"":String(charge.fundedDays));setRemoved(String(charge.removedDays||0));setReason("");setError("");dialog.current?.showModal();}}>Edit day count</button>
 <dialog ref={dialog} className={styles.dialog} aria-labelledby={`days-${charge.id}`} onCancel={e=>{if(busy)e.preventDefault();}}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{const r=await fetch(`/api/billing/runs/${runId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"set-funded-days",chargeId:charge.id,fundedDays:Number(days),removedDays:Number(removed),reason})});const d=await r.json();if(!r.ok)throw Error(d.error);dialog.current?.close();onSaved();}catch(e){setError(e instanceof Error?e.message:"Unable to save days.");}finally{setBusy(false);}}}>
 <h2 id={`days-${charge.id}`}>{charge.studentName} — funded days</h2>{error&&<p role="alert">{error}</p>}
 <label className="form-label">Agreed days for this period, before deductions<input className="field" type="number" min={0} max={366} step={0.5} required value={days} onChange={e=>setDays(e.target.value)}/></label>
 <p>Bank holidays deducted automatically: <b>{charge.bankHolidayDays||0}</b></p>
 <label className="form-label">Additional days removed by management<input className="field" type="number" min={0} max={Math.max(0,Number(days)-(charge.bankHolidayDays||0))} step={0.5} required value={removed} onChange={e=>setRemoved(e.target.value)}/></label>
 <p>Days to invoice: <b>{Math.max(0,Number(days)-(charge.bankHolidayDays||0)-Number(removed))}</b></p>
 <label className="form-label">Reason for this period’s count or removals<textarea className="field" required minLength={5} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={()=>dialog.current?.close()}>Cancel</button><button className="btn primary" disabled={busy}>{busy?"Saving…":"Save days"}</button></div>
 </form></dialog></>;
}
