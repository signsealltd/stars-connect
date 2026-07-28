"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Battery, BatteryCharging, TriangleAlert } from "lucide-react";
import {
  BATTERY_STORAGE_KEY,
  batterySeverity,
  type BatteryNavigatorLike,
  type BatterySnapshot,
  watchBattery,
} from "@/lib/battery-status";
import { isKioskRoute } from "@/lib/kiosk-context";

export function KioskBatteryStatus() {
  const pathname = usePathname();
  const kiosk = isKioskRoute(pathname);
  const [snapshot, setSnapshot] = useState<BatterySnapshot>();

  useEffect(() => {
    if (!kiosk) {
      setSnapshot(undefined);
      return;
    }
    return watchBattery(navigator as Navigator & BatteryNavigatorLike, (next) => {
      setSnapshot(next);
      if (next.available) localStorage.setItem(BATTERY_STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(BATTERY_STORAGE_KEY);
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

  if (!kiosk || !snapshot) return null;
  if (!snapshot.available) {
    return <div className="kiosk-battery unavailable" role="status"><Battery aria-hidden="true"/>Battery unavailable</div>;
  }

  const severity = batterySeverity(snapshot);
  const urgent = severity === "urgent";
  const label = urgent
    ? `Connect charger now — ${snapshot.level}% battery remaining`
    : severity === "critical"
      ? `Critical battery — ${snapshot.level}% remaining`
      : severity === "low"
        ? `Low battery — ${snapshot.level}% remaining`
        : `${snapshot.level}%${snapshot.charging ? " · Charging" : ""}`;

  return (
    <div
      className={`kiosk-battery ${severity} ${pathname === "/emergency" && severity !== "normal" ? "emergency-battery-banner" : ""}`}
      role="status"
      aria-live={severity === "critical" || urgent ? "assertive" : "polite"}
      aria-label={`Battery ${snapshot.level} percent${snapshot.charging ? ", charging" : ""}`}
    >
      {urgent ? <TriangleAlert aria-hidden="true"/> : snapshot.charging ? <BatteryCharging aria-hidden="true"/> : <Battery aria-hidden="true"/>}
      <span>{label}</span>
    </div>
  );
}
