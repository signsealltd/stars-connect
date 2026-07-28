export type BatterySnapshot =
  | { available: false; updatedAt: string }
  | { available: true; level: number; charging: boolean; updatedAt: string };

export type BatteryManagerLike = {
  level: number;
  charging: boolean;
  addEventListener: (type: "levelchange" | "chargingchange", listener: () => void) => void;
  removeEventListener: (type: "levelchange" | "chargingchange", listener: () => void) => void;
};

export type BatteryNavigatorLike = { getBattery?: () => Promise<BatteryManagerLike> };
export const BATTERY_STORAGE_KEY = "stars-connect-battery-status";

export function readBattery(manager: Pick<BatteryManagerLike, "level" | "charging">, now = new Date()): BatterySnapshot {
  return {
    available: true,
    level: Math.max(0, Math.min(100, Math.round(manager.level * 100))),
    charging: manager.charging,
    updatedAt: now.toISOString(),
  };
}

export function watchBattery(
  batteryNavigator: BatteryNavigatorLike,
  onUpdate: (snapshot: BatterySnapshot) => void,
  now: () => Date = () => new Date(),
) {
  let disposed = false;
  let manager: BatteryManagerLike | undefined;
  const update = () => {
    if (!disposed && manager) onUpdate(readBattery(manager, now()));
  };
  if (!batteryNavigator.getBattery) {
    onUpdate({ available: false, updatedAt: now().toISOString() });
  } else {
    void batteryNavigator.getBattery().then((battery) => {
      if (disposed) return;
      manager = battery;
      update();
      manager.addEventListener("levelchange", update);
      manager.addEventListener("chargingchange", update);
    }).catch(() => {
      if (!disposed) onUpdate({ available: false, updatedAt: now().toISOString() });
    });
  }
  return () => {
    disposed = true;
    if (!manager) return;
    manager.removeEventListener("levelchange", update);
    manager.removeEventListener("chargingchange", update);
  };
}

export function batterySeverity(snapshot: BatterySnapshot) {
  if (!snapshot.available || snapshot.charging || snapshot.level > 20) return "normal" as const;
  if (snapshot.level <= 5) return "urgent" as const;
  if (snapshot.level <= 10) return "critical" as const;
  return "low" as const;
}

export function batterySyncHeaders(storage: Pick<Storage, "getItem">): Record<string, string> {
  try {
    const snapshot = JSON.parse(storage.getItem(BATTERY_STORAGE_KEY) || "null") as BatterySnapshot | null;
    if (!snapshot?.available || !Number.isInteger(snapshot.level) || typeof snapshot.charging !== "boolean") return {};
    return {
      "x-battery-level": String(snapshot.level),
      "x-battery-charging": String(snapshot.charging),
      "x-battery-updated-at": snapshot.updatedAt,
    };
  } catch {
    return {};
  }
}
