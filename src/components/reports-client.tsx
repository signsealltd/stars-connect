"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { localDateKey } from "@/lib/dates";

type ReportType="daily-staff"|"weekly-staff"|"students"|"site"|"visitors";
export function ReportsClient(){
 const[type,setType]=useState<ReportType>("daily-staff"),[from,setFrom]=useState(localDateKey()),[to,setTo]=useState(localDateKey()),[data,setData]=useState<Record<string,unknown>[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");const r=await fetch(`/api/reports?type=${type}&from=${from}&to=${to}&format=json`);if(!r.ok){setError((await r.json()).error||"Unable to load report.");setData([])}else{const result=await r.json();setData(Array.isArray(result.data)?result.data:[result.data])}setLoading(false)},[type,from,to])
 useEffect(()=>{load()},[load]);
 const columns=data.length?Object.keys(data[0]).filter(k=>!["id","staff","students"].includes(k)):[];
 return <><div className="toolbar no-print"><select className="field" value={type} onChange={e=>setType(e.target.value as ReportType)}><option value="daily-staff">Daily staff</option><option value="weekly-staff">Weekly staff</option><option value="students">Student attendance</option><option value="site">Daily site</option><option value="visitors">Visitor book</option></select><label>From <input autoComplete="off" className="field" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To <input autoComplete="off" className="field" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><a className="btn primary" href={`/api/reports?type=${type}&from=${from}&to=${to}&format=csv`}><Download size={17}/> Export CSV</a><button className="btn secondary" onClick={()=>window.print()}><Printer size={17}/> Print</button></div>{error&&<div className="alert alert-error">{error}</div>}<section className="card table-wrap">{loading?<div className="empty">Loading report…</div>:data.length?<table className="table"><thead><tr>{columns.map(c=><th key={c}>{c.replace(/([A-Z])/g," $1")}</th>)}</tr></thead><tbody>{data.map((row,i)=><tr key={i}>{columns.map(c=><td key={c}>{Array.isArray(row[c])?row[c].join(", "):typeof row[c]==="boolean"?(row[c]?"Yes":"No"):row[c] instanceof Object?JSON.stringify(row[c]):String(row[c]??"—")}</td>)}</tr>)}</tbody></table>:<div className="empty">No records match this report.</div>}</section></>
}
