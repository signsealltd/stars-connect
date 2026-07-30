"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { localDateKey } from "@/lib/dates";

type ReportType="daily-staff"|"weekly-staff"|"students"|"site"|"visitors";
function displayReportValue(value:unknown){if(value==null||value==="")return "—";if(typeof value==="boolean")return value?"Yes":"No";if(Array.isArray(value))return value.join(", ");if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T/.test(value)){const date=new Date(value);return date.toLocaleString("en-GB",{timeZone:"Europe/London",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)){const[y,m,d]=value.split("-");return`${d}/${m}/${y}`}if(typeof value==="object")return JSON.stringify(value);return String(value)}
export function ReportsClient(){
 const[type,setType]=useState<ReportType>("daily-staff"),[from,setFrom]=useState(localDateKey()),[to,setTo]=useState(localDateKey()),[data,setData]=useState<Record<string,unknown>[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");const r=await fetch(`/api/reports?type=${type}&from=${from}&to=${to}&format=json`);if(!r.ok){setError((await r.json()).error||"Unable to load report.");setData([])}else{const result=await r.json();setData(Array.isArray(result.data)?result.data:[result.data])}setLoading(false)},[type,from,to])
 useEffect(()=>{load()},[load]);
 const columns=data.length?Object.keys(data[0]).filter(k=>!["id","staff","students"].includes(k)):[];
 return <><div className="toolbar no-print"><select className="field" value={type} onChange={e=>setType(e.target.value as ReportType)}><option value="daily-staff">Daily staff</option><option value="weekly-staff">Weekly staff</option><option value="students">Student attendance</option><option value="site">Daily site</option><option value="visitors">Visitor book</option></select><label>From <input autoComplete="off" className="field" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To <input autoComplete="off" className="field" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><a className="btn primary" href={`/api/reports?type=${type}&from=${from}&to=${to}&format=csv`}><Download size={17}/> Export CSV</a><button className="btn secondary" onClick={()=>window.print()}><Printer size={17}/> Print</button></div>{error&&<div className="alert alert-error">{error}</div>}<section className="card table-wrap">{loading?<div className="empty">Loading report...</div>:data.length?<table className="table"><thead><tr>{columns.map(c=><th key={c}>{c.replace(/([A-Z])/g," $1")}</th>)}</tr></thead><tbody>{data.map((row,i)=><tr key={i}>{columns.map(c=><td key={c}>{displayReportValue(row[c])}</td>)}</tr>)}</tbody></table>:<div className="empty">No records match this report.</div>}</section></>
}

