"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { shouldRegisterServiceWorker } from "@/lib/kiosk-context";
export function ServiceWorkerRegistration(){const pathname=usePathname();useEffect(()=>{if(!("serviceWorker" in navigator))return;if(!shouldRegisterServiceWorker(pathname,localStorage))return;navigator.serviceWorker.register("/sw.js").catch(()=>undefined)},[pathname]);return null}