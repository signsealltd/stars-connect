"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  BATTERY_STORAGE_KEY,
  type BatteryNavigatorLike,
  watchBattery,
} from "@/lib/battery-status";
import { isKioskRoute } from "@/lib/kiosk-context";

export function KioskBatteryStatus() {
  const pathname = usePathname();
  const kiosk = isKioskRoute(pathname);

  useEffect(() => {
    if (!kiosk) return;
    return watchBattery(navigator as Navigator & BatteryNavigatorLike, (next) => {
      if (next.available) localStorage.setItem(BATTERY_STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(BATTERY_STORAGE_KEY);
      dispatchEvent(new CustomEvent("stars-connect-battery", { detail: next }));
    });
  }, [kiosk]);

  useEffect(() => {
    if (!kiosk) return;
    document.body.classList.add("kiosk-route");
    const blockContextMenu = (event: MouseEvent) => event.preventDefault();
    const blockImageDrag = (event: DragEvent) => {
      if (event.target instanceof HTMLImageElement) event.preventDefault();
    };
    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("dragstart", blockImageDrag);
    return () => {
      document.body.classList.remove("kiosk-route");
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("dragstart", blockImageDrag);
    };
  }, [kiosk]);

  return null;
}