"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
export function StaffTaskSummary(){const [count,setCount]=useState<number|null>(null);useEffect(()=>{fetch('/api/staff-tasks?summary=1',{cache:'no-store'}).then(async r=>{if(r.ok)setCount((await r.json()).count)}).catch(()=>{})},[]);return count===null?null:<Link className="card" href="/dashboard/staff/tasks" style={{display:'block',padding:20,marginBottom:16,color:'#24132f',textDecoration:'none'}}><strong>Staff tasks · {count}</strong><p style={{margin:'4px 0 0'}}>Requests and attendance responses awaiting review →</p></Link>}
