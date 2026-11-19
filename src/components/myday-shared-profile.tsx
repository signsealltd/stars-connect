"use client";
import {mydayPlanNotes} from "@/lib/myday-rules";
import {useCallback,useEffect,useState} from "react";
import {MyDayIdentity,MyDayPhotoEditor,type MyDayClientIdentity} from "./myday-identity";
export function MyDaySharedProfile({studentId}:{studentId:string}){
 const [client,setClient]=useState<MyDayClientIdentity|null>(null),[photo,setPhoto]=useState(false),[notes,setNotes]=useState<Array<{id:string;text:string;author:string;createdAt:string}>>([]);
 const load=useCallback(async()=>{const r=await fetch(`/api/myday?client=${studentId}`,{cache:"no-store"});if(!r.ok)return;const d=await r.json();setClient(d.client);setNotes(mydayPlanNotes(d.client.plan||{}))},[studentId]);useEffect(()=>{void load()},[load]);
 if(!client)return null;return <section style={{marginBottom:20}}><MyDayIdentity client={client} onPhoto={()=>setPhoto(true)}/>{notes.length>0&&<><h3>Additional person-centred notes</h3>{notes.map(n=><article key={n.id} style={{borderBottom:"1px solid #e6dce9",padding:"10px 0"}}><small>{n.author} · {n.createdAt?n.createdAt.slice(0,10):"Date not recorded"}</small><p style={{whiteSpace:"pre-wrap"}}>{n.text}</p></article>)}</>}{photo&&<MyDayPhotoEditor client={client} onClose={()=>setPhoto(false)} onSaved={()=>void load()}/>}</section>;
}
