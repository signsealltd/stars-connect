"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ShieldAlert} from "lucide-react";
import styles from "./dashboard-notes.module.css";
type Enquiry={id:string;studentName:string;absenceDates:string[];status:string;notes?:string;createdAt:string;closedAt?:string;closedByName?:string};
const dateLabel=(value:string)=>new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
export function SafeguardingBox(){
 const [rows,setRows]=useState<Enquiry[]>([]),[openCount,setOpenCount]=useState(0),[total,setTotal]=useState(0),[page,setPage]=useState(1),[history,setHistory]=useState(false),[opened,setOpened]=useState(false),[loading,setLoading]=useState(false);
 const [selected,setSelected]=useState<string|null>(null),[notes,setNotes]=useState(""),[outcome,setOutcome]=useState("NO_CONCERNS"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[allowed,setAllowed]=useState(false);
 const [policy,setPolicy]=useState({mode:"ACCUMULATED",windowDays:0}),[draftPolicy,setDraftPolicy]=useState(policy);
 const dialog=useRef<HTMLDialogElement>(null),requestVersion=useRef(0);
 const load=useCallback(async()=>{
  const version=++requestVersion.current;setLoading(true);
  try{
   const response=await fetch(`/api/safeguarding?summary=${!opened}&history=${history}&page=${page}`,{cache:"no-store"});
   if(version!==requestVersion.current)return;
   if(response.status===403||response.status===401){setAllowed(false);return;}
   const body=await response.json();if(version!==requestVersion.current)return;
   if(!response.ok)throw Error(body.error||"Unable to load safeguarding enquiries.");
   setAllowed(true);setOpenCount(body.openCount);setPolicy(body.policy);setError("");
   if(opened){setRows(body.rows);setTotal(body.total);const last=Math.max(1,Math.ceil(body.total/25));if(page>last)setPage(last);}
  }catch(e){if(version===requestVersion.current)setError(e instanceof Error?e.message:"Unable to load safeguarding enquiries.");}
  finally{if(version===requestVersion.current)setLoading(false);}
 },[opened,history,page]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),30000);const requests=requestVersion;return()=>{clearInterval(timer);requests.current++;};},[load]);
 async function update(body:Record<string,unknown>){
  setBusy(true);setError("");try{const response=await fetch("/api/safeguarding",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.error||"Unable to save this change.");setSelected(null);setNotes("");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to save this change.");}finally{setBusy(false);}
 }
 if(!allowed&&!error)return null;
 return <section>
  <button className={`card ${styles.trigger} ${openCount?styles.attention:styles.healthy}`} aria-haspopup="dialog" onClick={()=>{setOpened(true);setSelected(null);setHistory(false);setPage(1);setDraftPolicy(policy);dialog.current?.showModal();}}>
   <span className={styles.title}><ShieldAlert size={24} aria-hidden="true"/> Safeguarding</span><strong>{error&&!allowed?"—":openCount}</strong><span>{openCount===1?"Open trigger to investigate":"Open triggers to investigate"}</span><small className="muted">3 recorded absences trigger an enquiry. Click to review.</small>
  </button>
  {error&&!opened&&<p role="alert">{error}</p>}
  <dialog ref={dialog} className={`${styles.dialog} ${styles.review}`} aria-labelledby="safeguarding-title" onCancel={e=>{if(busy)e.preventDefault();}} onClose={()=>{setOpened(false);setSelected(null);}}>
   <div className={styles.heading}><h2 id="safeguarding-title">Safeguarding enquiries</h2><button className="btn secondary" disabled={busy} onClick={()=>dialog.current?.close()}>Close list</button></div>
   <p><b>{openCount} open {openCount===1?"trigger":"triggers"}</b> · Each enquiry groups a client’s qualifying absences.</p>
   <p className="muted">Trigger: 3 {policy.mode==="CONSECUTIVE"?"consecutive recorded absences":"accumulated absences since the previous enquiry"}{policy.windowDays?` within ${policy.windowDays} days`:""}.</p>
   <label className="check-row"><input type="checkbox" checked={history} disabled={busy} onChange={e=>{setHistory(e.target.checked);setPage(1);setSelected(null);}}/>Include closed enquiries</label>
   {error&&<p role="alert">{error} <button className="btn ghost" onClick={()=>void load()}>Retry</button></p>}
   {loading&&<p role="status">Refreshing enquiries…</p>}
   {!loading&&!rows.length&&<p className="empty">{history?"No enquiries recorded.":"No open triggers to investigate."}</p>}
   {rows.map(row=><article className={styles.enquiry} key={row.id}>
    <div className={styles.heading}><h3>{row.studentName}</h3><span className={`badge ${row.status==="OPEN"?"badge-warning":"badge-neutral"}`}>{row.status==="OPEN"?"Open":row.status==="NO_CONCERNS"?"Closed — no concerns":"Closed — referred"}</span></div>
    <small className="muted">Raised {dateLabel(row.createdAt)} · {row.absenceDates.length} recorded absences</small>
    <div className={styles.dates}>{row.absenceDates.map(date=><span className="badge badge-neutral" key={date}>{dateLabel(date)}</span>)}</div>
    {row.status!=="OPEN"?<><p style={{whiteSpace:"pre-wrap"}}>{row.notes}</p><small className="muted">Closed by {row.closedByName}{row.closedAt&&` · ${dateLabel(row.closedAt)}`}</small></>:selected!==row.id?<button className="btn primary" disabled={busy} onClick={()=>{setSelected(row.id);setNotes("");setOutcome("NO_CONCERNS");}}>Investigate / close</button>:<form className={styles.investigation} onSubmit={e=>{e.preventDefault();void update({action:"close",id:row.id,outcome,notes});}}>
     <label className="form-label">Outcome<select className="field" value={outcome} disabled={busy} onChange={e=>setOutcome(e.target.value)}><option value="NO_CONCERNS">Close — no concerns found</option><option value="REFERRED">Close — referred for further action</option></select></label>
     <label className="form-label">Investigation and follow-up notes<textarea className="field" required minLength={5} maxLength={5000} rows={4} disabled={busy} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
     <div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={()=>setSelected(null)}>Cancel investigation</button><button className="btn primary" disabled={busy||notes.trim().length<5}>{busy?"Saving…":"Close enquiry"}</button></div>
    </form>}
   </article>)}
   {total>25&&<div className="toolbar"><button className="btn secondary" disabled={busy||loading||page<=1} onClick={()=>{setPage(page-1);setSelected(null);}}>Previous</button><span>Page {page} of {Math.ceil(total/25)}</span><button className="btn secondary" disabled={busy||loading||page*25>=total} onClick={()=>{setPage(page+1);setSelected(null);}}>Next</button></div>}
   <details><summary>Absence counting settings</summary><label className="form-label">Counting rule<select className="field" value={draftPolicy.mode} disabled={busy} onChange={e=>setDraftPolicy({...draftPolicy,mode:e.target.value})}><option value="ACCUMULATED">Accumulated since last enquiry</option><option value="CONSECUTIVE">Consecutive recorded absences</option></select></label>
    <label className="form-label">Window in days (0 = no time limit)<input className="field" type="number" min={0} max={365} disabled={busy} value={draftPolicy.windowDays} onChange={e=>setDraftPolicy({...draftPolicy,windowDays:Number(e.target.value)})}/></label><button className="btn secondary" disabled={busy} onClick={()=>void update({action:"policy",...draftPolicy})}>Save counting rule</button>
   </details>
  </dialog>
 </section>;
}
