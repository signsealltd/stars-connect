"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
export function MyDayShortcut(){const [enabled,setEnabled]=useState(false);useEffect(()=>{fetch("/api/myday/auth",{cache:"no-store"}).then(async r=>{if(r.ok)setEnabled((await r.json()).enabled===true)}).catch(()=>{});},[]);return enabled?<Link className="card staff-card" href="/myday" style={{display:"block",padding:18,margin:"14px 0",border:"1px solid #d9c4e1",textDecoration:"none",color:"#54205d"}}><b style={{fontSize:20}}>My Day →</b><span style={{display:"block",marginTop:5}}>Client diaries, activities and shared plans</span></Link>:null;}
