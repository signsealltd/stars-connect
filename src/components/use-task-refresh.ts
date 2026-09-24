"use client";
import {useEffect,useRef} from "react";
export function useTaskRefresh(refresh:()=>unknown){
 const latest=useRef(refresh);useEffect(()=>{latest.current=refresh},[refresh]);
 useEffect(()=>{const reload=()=>{void Promise.resolve(latest.current()).catch(()=>{})};const storage=(e:StorageEvent)=>{if(e.key==="stars-tasks-updated")reload()};window.addEventListener("stars-tasks-updated",reload);window.addEventListener("storage",storage);window.addEventListener("focus",reload);return()=>{window.removeEventListener("stars-tasks-updated",reload);window.removeEventListener("storage",storage);window.removeEventListener("focus",reload)}},[]);
}
