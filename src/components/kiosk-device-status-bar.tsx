"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Battery, BatteryCharging, Tablet } from "lucide-react";
import { BATTERY_STORAGE_KEY, batterySeverity, type BatteryNavigatorLike, type BatterySnapshot } from "@/lib/battery-status";
import {
  batteryStatusText,
  shouldShowBatteryStatus,
  type DeviceConfiguration,
} from "@/lib/device-battery-display";
import { getSyncSnapshot } from "@/lib/local-db";
import { hasDeviceCredential, isKioskRoute } from "@/lib/kiosk-context";

type SyncSnapshot = {
  lastSync?: string;
  queued: number;
  conflicts: number;
};

export function KioskDeviceStatusContent({
  deviceName,
  configuration,
  battery,
  sync,
  emergency = false,
}: {
  deviceName: string;
  configuration?: DeviceConfiguration;
  battery?: BatterySnapshot;
  sync: SyncSnapshot;
  emergency?: boolean;
}) {
  const visible = shouldShowBatteryStatus(true, configuration, battery);
  const supportedBattery = visible && battery?.available ? battery : undefined;
  const severity = supportedBattery ? batterySeverity(supportedBattery) : "normal";

  return (
    <footer
      className={`kiosk-device-status-bar${emergency ? " emergency" : ""}`}
      style={{ display: "flex", flexWrap: "wrap" }}
      aria-label="Device status"
    >
      <span className="kiosk-status-item device-name"><Tablet aria-hidden="true"/><b>{deviceName}</b></span>
      {supportedBattery && (
        <span
          className={`kiosk-status-item battery-inline ${severity}`}
          role="status"
          aria-label={`Battery ${supportedBattery.level} percent${supportedBattery.charging ? ", charging" : ""}`}
        >
          {supportedBattery.charging ? <BatteryCharging aria-hidden="true"/> : <Battery aria-hidden="true"/>}
          {batteryStatusText(supportedBattery)}
        </span>
      )}
      <span className="kiosk-status-item">Last synced {sync.lastSync ? new Date(sync.lastSync).toLocaleTimeString("en-GB") : "not yet"}</span>
      <span className="kiosk-status-item">{sync.queued} queued upload{sync.queued === 1 ? "" : "s"}</span>
      <span className="kiosk-status-item">{sync.conflicts} local conflict{sync.conflicts === 1 ? "" : "s"}</span>
      <span className="kiosk-status-item app-version">STARS Connect v1.0</span>
    </footer>
  );
}

export function KioskDeviceStatusBar() {
  const pathname = usePathname();
  const kiosk = isKioskRoute(pathname);
  const [provisioned, setProvisioned] = useState(false);
  const [deviceName, setDeviceName] = useState("Device");
  const [configuration, setConfiguration] = useState<DeviceConfiguration>();
  const [battery, setBattery] = useState<BatterySnapshot>();
  const [sync, setSync] = useState<SyncSnapshot>({ queued: 0, conflicts: 0 });

  const refreshConfiguration = useCallback(async () => {
    const id = localStorage.getItem("pulse-device-id");
    const token = localStorage.getItem("pulse-device-token");
    if (!id || !token || !navigator.onLine) return;
    const response = await fetch("/api/kiosk/screensaver", {
      headers: { "x-device-id": id, authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return;
    const body = await response.json();
    if (body.deviceConfiguration) setConfiguration(body.deviceConfiguration);
  }, []);

  useEffect(() => {
    if (!kiosk) return;
    const authorised = hasDeviceCredential(localStorage);
    setProvisioned(authorised);
    setDeviceName(localStorage.getItem("pulse-device-name") || "Provisioned device");
    if ((navigator as Navigator & BatteryNavigatorLike).getBattery) {
      try {
        const cachedBattery = JSON.parse(localStorage.getItem(BATTERY_STORAGE_KEY) || "null") as BatterySnapshot | null;
        if (cachedBattery?.available) setBattery(cachedBattery);
      } catch { setBattery(undefined); }
    }
    void getSyncSnapshot().then(value => setSync(value as SyncSnapshot));
    if (authorised) void refreshConfiguration();

    const batteryUpdate = (event: Event) => setBattery((event as CustomEvent<BatterySnapshot>).detail);
    const configurationUpdate = (event: Event) => setConfiguration((event as CustomEvent<DeviceConfiguration>).detail);
    const syncUpdate = (event: Event) => setSync((event as CustomEvent<SyncSnapshot>).detail);
    addEventListener("stars-connect-battery", batteryUpdate);
    addEventListener("stars-connect-device-config", configurationUpdate);
    addEventListener("stars-connect-sync", syncUpdate);
    addEventListener("online", refreshConfiguration);
    const interval = window.setInterval(refreshConfiguration, 300_000);
    return () => {
      removeEventListener("stars-connect-battery", batteryUpdate);
      removeEventListener("stars-connect-device-config", configurationUpdate);
      removeEventListener("stars-connect-sync", syncUpdate);
      removeEventListener("online", refreshConfiguration);
      clearInterval(interval);
    };
  }, [kiosk, refreshConfiguration]);

  useEffect(() => {
    if (kiosk && provisioned) document.body.classList.add("has-kiosk-status-bar");
    else document.body.classList.remove("has-kiosk-status-bar");
    return () => document.body.classList.remove("has-kiosk-status-bar");
  }, [kiosk, provisioned]);

  if (!kiosk || !provisioned) return null;
  return (
    <KioskDeviceStatusContent
      deviceName={deviceName}
      configuration={configuration}
      battery={battery}
      sync={sync}
      emergency={pathname === "/emergency"}
    />
  );
}
