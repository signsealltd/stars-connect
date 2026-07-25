"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Tablet } from "lucide-react";

export default function SetupPage(){
 const[code,setCode]=useState(""),[error,setError]=useState(""),[done,setDone]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setError("");const r=await fetch("/api/devices/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({setupCode:code.trim()})});const d=await r.json();if(!r.ok){setError(d.error||"Unable to authorise this tablet.");return}localStorage.setItem("pulse-device-id",d.id);localStorage.setItem("pulse-device-token",d.token);localStorage.setItem("pulse-device-name",d.name);setDone(true)}
 return <main className="shell"><div className="content"><section className="card" style={{maxWidth:620,margin:"40px auto",padding:28}}><div className="logo-panel"><Image src="/branding/stars-logo.svg" alt="STARS" width={180} height={130}/></div>{done?<div style={{textAlign:"center",padding:24}}><CheckCircle2 size={64} color="var(--success)"/><h1>Tablet authorised</h1><p className="muted">This tablet is ready to use STARS Connect.</p><Link className="btn primary" href="/">Open kiosk</Link></div>:<form onSubmit={submit}><h1><Tablet/> Set up this tablet</h1><p className="muted">Ask an administrator to create a one-time setup code in Devices, then paste it below.</p>{error&&<div className="alert alert-error">{error}</div>}<label className="form-label" style={{marginTop:18}}>One-time setup code<textarea className="field" value={code} onChange={e=>setCode(e.target.value)} required autoComplete="off"/></label><button className="btn primary" style={{width:"100%",marginTop:18}}>Authorise tablet</button></form>}</section></div></main>
}
