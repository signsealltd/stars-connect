"use client";
import {useEffect,useState} from "react";
import {myDayDate} from "@/lib/myday-rules";
export function useMyDayRegisterNotes(enabled:boolean){
 const [notes,setNotes]=useState<Array<{id:string;studentId:string}>>([]),[day,setDay]=useState(myDayDate());
 useEffect(()=>{if(!enabled){setNotes([]);return;}let active=true;const load=async()=>{setDay(myDayDate());try{const r=await fetch("/api/myday/markers",{cache:"no-store"});if(!r.ok){if(active)setNotes([]);return;}const d=await r.json();if(active)setNotes(d.day===myDayDate()?d.notes:[]);}catch{/* Do not show yesterday's notes while disconnected. */}};void load();const timer=setInterval(()=>void load(),15_000);return()=>{active=false;clearInterval(timer)};},[enabled]);
 return day===myDayDate()?notes:[];
}
export function MyDayRegisterNote({studentId,notes}:{studentId:string;notes:Array<{id:string;studentId:string}>}){const matches=notes.filter(n=>n.studentId===studentId);if(!matches.length)return null;return <a href={`/myday?client=${studentId}&note=${matches[0].id}&from=register`} onClick={()=>sessionStorage.setItem("myday-register-scroll",String(window.scrollY))} style={{display:"inline-block",marginTop:7,padding:"6px 10px",borderRadius:8,background:"#fff0d9",color:"#75420c",fontWeight:700}}>Handover note{matches.length>1?`s (${matches.length})`:""}</a>;}
