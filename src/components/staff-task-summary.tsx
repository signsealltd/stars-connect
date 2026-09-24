"use client";
import {useTaskRefresh} from "./use-task-refresh";
import {useEffect,useState} from "react";
import Link from "next/link";
export function StaffTaskSummary(){const [count,setCount]=useState<number|null>(null);const load=()=>{Promise.all(['/api/staff-tasks?summary=1','/api/tasks-overview'].map(url=>fetch(url,{cache:'no-store'}).then(async r=>r.ok?(await r.json()).count:null))).then(counts=>{if(counts.some(c=>c!==null))setCount(counts.reduce((total,c)=>total+(c||0),0))}).catch(()=>{})};useEffect(load,[]);useTaskRefresh(load);return count===null?null:<Link className="card" href="/dashboard/staff/tasks" style={{display:'block',padding:20,marginBottom:16,color:'#24132f',textDecoration:'none'}}><strong>Tasks · {count}</strong><p style={{margin:'4px 0 0'}}>Staff requests, system and compliance actions →</p></Link>}
