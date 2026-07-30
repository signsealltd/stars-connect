/* eslint-disable @next/next/no-img-element */
"use client";
import{useEffect,useState}from"react";
import{Eye,Save}from"lucide-react";
type Logo={id:string;name:string;url:string};
type Settings={invoicePrefix:string;organisationLegalName:string;organisationAddress:string;companyNumber:string;vatNumber:string;bankDetails:string;remittanceInstructions:string;defaultPaymentTerms:string;invoiceLogoUrl:string};
export function BillingSettings(){const[s,setS]=useState<Settings|null>(null),[logos,setLogos]=useState<Logo[]>([]),[message,setMessage]=useState(""),[busy,setBusy]=useState("");useEffect(()=>{Promise.all([fetch("/api/settings/billing").then(r=>r.json()),fetch("/api/settings/organisation").then(r=>r.json())]).then(([billing,organisation])=>{setS({...billing,invoiceLogoUrl:billing.invoiceLogoUrl||organisation.organisationLogoUrl});setLogos(organisation.organisationLogos||[])}).catch(()=>setMessage("Unable to load invoice settings."))},[]);
async function save(e:React.FormEvent){e.preventDefault();if(!s)return;setBusy("save");const r=await fetch("/api/settings/billing",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(s)}),j=await r.json();setMessage(r.ok?"Billing settings saved.":j.error||"Unable to save.");setBusy("")}
async function preview(){if(!s)return;setBusy("preview");setMessage("");const r=await fetch("/api/settings/billing/preview",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(s)});if(!r.ok){const j=await r.json().catch(()=>null);setMessage(j?.error||"Invoice preview could not be created.");setBusy("");return}const url=URL.createObjectURL(await r.blob());window.open(url,"_blank","noopener,noreferrer");setTimeout(()=>URL.revokeObjectURL(url),60000);setBusy("")}
if(!s)return <div className="empty">Loading billing settings...</div>;return <form autoComplete="off" className="card form-grid" onSubmit={save}>
<div className="span-2"><h2>Invoice and payment details</h2><p className="muted">These details appear on official invoices. Blank VAT information is omitted from the invoice.</p></div>
<label>Invoice prefix<input autoComplete="off" className="field" value={s.invoicePrefix} onChange={e=>setS({...s,invoicePrefix:e.target.value.toUpperCase()})}/></label>
<label>Invoice logo<select className="field" value={s.invoiceLogoUrl} onChange={e=>setS({...s,invoiceLogoUrl:e.target.value})}>{logos.map(logo=><option value={logo.url} key={logo.id}>{logo.name}</option>)}</select>{s.invoiceLogoUrl&&<img src={s.invoiceLogoUrl} alt="Invoice logo preview" className="invoice-logo-preview"/>}</label>
<label>Legal organisation name<input autoComplete="off" className="field" value={s.organisationLegalName} onChange={e=>setS({...s,organisationLegalName:e.target.value})}/></label>
<label>Company number<input autoComplete="off" className="field" value={s.companyNumber} onChange={e=>setS({...s,companyNumber:e.target.value})}/></label>
<label className="span-2">Organisation address<textarea autoComplete="off" className="field" rows={3} value={s.organisationAddress} onChange={e=>setS({...s,organisationAddress:e.target.value})}/></label>
<label>VAT number (optional)<input autoComplete="off" className="field" value={s.vatNumber} onChange={e=>setS({...s,vatNumber:e.target.value})}/></label>
<label>Default payment terms<input autoComplete="off" className="field" value={s.defaultPaymentTerms} onChange={e=>setS({...s,defaultPaymentTerms:e.target.value})}/></label>
<label className="span-2">Bank/payment details<textarea autoComplete="off" className="field" rows={5} value={s.bankDetails} onChange={e=>setS({...s,bankDetails:e.target.value})}/><small className="muted">Use one detail per line. Up to five lines are shown.</small></label>
<label className="span-2">Remittance instructions<textarea autoComplete="off" className="field" rows={3} value={s.remittanceInstructions} onChange={e=>setS({...s,remittanceInstructions:e.target.value})}/></label>
{message&&<div className={message.includes("saved")?"alert alert-success span-2":"alert alert-error span-2"}>{message}</div>}
<div className="span-2 modal-actions"><button type="button" className="btn secondary" onClick={preview} disabled={!!busy}><Eye size={17}/>{busy==="preview"?"Preparing preview...":"Preview invoice"}</button><button className="btn primary" disabled={!!busy}><Save size={17}/>{busy==="save"?"Saving...":"Save billing settings"}</button></div>
</form>}
