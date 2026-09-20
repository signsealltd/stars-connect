"use client";
import {useCallback,useEffect,useState} from "react";
export type BillingPeriodOption={id:string;label:string;cycle:string;invoiceMonth:string;periodStart:string;periodEnd:string;bankHolidayDates:string[]};
const blank={label:"",cycle:"LBE",invoiceMonth:"",periodStart:"",periodEnd:""};
export function BillingPeriodSetup(){
 const [rows,setRows]=useState<BillingPeriodOption[]>([]),[form,setForm]=useState<typeof blank&{id?:string}>(blank),[year,setYear]=useState(new Date().getFullYear()),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const load=useCallback(async()=>{const r=await fetch("/api/billing/periods",{cache:"no-store"});if(r.ok)setRows(await r.json());},[]);
 useEffect(()=>{void load();},[load]);
 async function save(body:unknown){setBusy(true);setMessage("");try{const r=await fetch("/api/billing/periods",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(result.error);setMessage("Periods saved. Billing tasks are on the operational calendar.");setForm(blank);await load();window.dispatchEvent(new Event("billing-periods-changed"));}catch(e){setMessage(e instanceof Error?e.message:"Unable to save periods.");}finally{setBusy(false);}}
 return <details className="card" style={{padding:20,marginBottom:20}}><summary><b>Set up billing periods</b> · {rows.length} saved</summary>
  <p>LBE uses the council’s From–To dates. Other clients use complete calendar months. Each saved period creates a billing task due on its final day.</p>
  <div className="toolbar"><label>Calendar year<input className="field" type="number" min={2020} max={2100} value={year} onChange={e=>setYear(Number(e.target.value))}/></label><button className="btn secondary" disabled={busy} onClick={()=>void save({preset:"MONTHLY",year})}>Add full monthly periods</button></div>
  <p className="muted">Existing periods are kept when loading a year. LBE bank holidays come from the <a href="https://www.gov.uk/bank-holidays" target="_blank" rel="noreferrer">GOV.UK England and Wales calendar</a>.</p>
  {message&&<p role="status">{message}</p>}
  <form onSubmit={e=>{e.preventDefault();void save(form);}}><h3>{form.id?"Edit period":"Add a period"}</h3><div className="form-grid">
   <label className="form-label">Label<input className="field" required maxLength={191} value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></label>
   <label className="form-label">Billing group<select className="field" value={form.cycle} onChange={e=>setForm({...form,cycle:e.target.value})}><option value="LBE">LBE / Enfield</option><option value="MONTHLY">Other clients — full month</option></select></label>
   <label className="form-label">Invoice month<input className="field" required type="month" value={form.invoiceMonth} onChange={e=>{const month=e.target.value;setForm({...form,invoiceMonth:month,...(form.cycle==="MONTHLY"&&month?{periodStart:`${month}-01`,periodEnd:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10)}:{})});}}/></label>
   <label className="form-label">From<input className="field" required type="date" value={form.periodStart} onChange={e=>setForm({...form,periodStart:e.target.value})}/></label><label className="form-label">To<input className="field" required type="date" value={form.periodEnd} onChange={e=>setForm({...form,periodEnd:e.target.value})}/></label>
  </div><div className="toolbar"><button className="btn primary" disabled={busy}>{busy?"Saving…":"Save period"}</button><button type="button" className="btn secondary" onClick={()=>setForm(blank)}>Clear</button></div></form>
  <div className="table-wrap"><table className="table"><thead><tr><th>Invoice month</th><th>Period</th><th>From – To</th><th>Bank holidays deducted</th><th/></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.invoiceMonth}</td><td>{row.label}</td><td>{row.periodStart.slice(0,10)} – {row.periodEnd.slice(0,10)}</td><td>{row.bankHolidayDates.join(", ")||"None"}</td><td><button className="btn secondary" onClick={()=>setForm({...row,periodStart:row.periodStart.slice(0,10),periodEnd:row.periodEnd.slice(0,10)})}>Edit</button></td></tr>)}</tbody></table></div>
 </details>;
}
