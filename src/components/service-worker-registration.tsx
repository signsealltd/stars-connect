"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { hasDeviceCredential, isKioskRoute, shouldRegisterServiceWorker } from "@/lib/kiosk-context";
import { syncNow } from "@/lib/local-db";

const KIOSK_HEARTBEAT_MS = 60_000;
const SYNC_REQUEST_POLL_MS = 5_000;

export function ServiceWorkerRegistration(){
 const pathname=usePathname();
 useEffect(()=>{if(!("serviceWorker" in navigator)||!shouldRegisterServiceWorker(pathname,localStorage))return;navigator.serviceWorker.register("/sw.js").catch(()=>undefined)},[pathname]);
 useEffect(()=>{
  if(!isKioskRoute(pathname)||!hasDeviceCredential(localStorage))return;
  const heartbeat=()=>{if(navigator.onLine&&document.visibilityState==="visible")void syncNow()};
  const checkRequest=async()=>{
   if(!navigator.onLine||document.visibilityState!=="visible")return;
   const response=await fetch("/api/devices/sync-request",{headers:{"x-device-id":localStorage.getItem("pulse-device-id")!,authorization:`Bearer ${localStorage.getItem("pulse-device-token")!}`},cache:"no-store"}).catch(()=>null);
   if(response?.ok&&(await response.json()).requested)await syncNow();
  };
  heartbeat();void checkRequest();
  const timer=window.setInterval(heartbeat,KIOSK_HEARTBEAT_MS),requestTimer=window.setInterval(()=>void checkRequest(),SYNC_REQUEST_POLL_MS);
  window.addEventListener("online",heartbeat);window.addEventListener("focus",heartbeat);document.addEventListener("visibilitychange",heartbeat);
  return()=>{window.clearInterval(timer);window.clearInterval(requestTimer);window.removeEventListener("online",heartbeat);window.removeEventListener("focus",heartbeat);document.removeEventListener("visibilitychange",heartbeat)};
 },[pathname]);
 return null
}