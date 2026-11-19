"use client";
import {useEffect} from "react";
// Replay sealed submissions on reconnect even after leaving My Day or signing out.
// No staff session, plaintext entry or authorisation secret is read from storage.
export function MyDayQueueSync(){useEffect(()=>{const sync=async()=>{if(!navigator.onLine||!globalThis.indexedDB)return;const {mydayQueueCount,syncMydayQueue}=await import("@/lib/myday-queue");if(await mydayQueueCount())await syncMydayQueue();};void sync().catch(()=>{});const retry=()=>void sync().catch(()=>{});window.addEventListener("online",retry);const timer=setInterval(retry,30_000);return()=>{window.removeEventListener("online",retry);clearInterval(timer)};},[]);return null;}
