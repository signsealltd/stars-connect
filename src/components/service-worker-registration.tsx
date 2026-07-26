"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { hasDeviceCredential, isKioskRoute, shouldRegisterServiceWorker } from "@/lib/kiosk-context";
import { syncNow } from "@/lib/local-db";

const KIOSK_HEARTBEAT_MS = 60_000;

export function ServiceWorkerRegistration(){
 const pathname=usePathname();
 useEffect(()=>{if(!("serviceWorker" in navigator)||!shouldRegisterServiceWorker(pathname,localStorage))return;navigator.serviceWorker.register("/sw.js").catch(()=>undefined)},[pathname]);
 useEffect(()=>{
  if(!isKioskRoute(pathname)||!hasDeviceCredential(localStorage))return;
  const heartbeat=()=>{if(navigator.onLine&&document.visibilityState==="visible")void syncNow()};
  heartbeat();
  const timer=window.setInterval(heartbeat,KIOSK_HEARTBEAT_MS);
  window.addEventListener("online",heartbeat);window.addEventListener("focus",heartbeat);document.addEventListener("visibilitychange",heartbeat);
  return()=>{window.clearInterval(timer);window.removeEventListener("online",heartbeat);window.removeEventListener("focus",heartbeat);document.removeEventListener("visibilitychange",heartbeat)};
 },[pathname]);
 return null
}
