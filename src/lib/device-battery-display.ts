import type { BatterySnapshot } from "./battery-status";

export type DeviceConfiguration = {
  deviceType: "KIOSK_TABLET" | "MANAGER_DESKTOP";
  showBatteryStatus: boolean;
};

export function shouldShowBatteryStatus(
  provisioned: boolean,
  configuration: DeviceConfiguration | undefined,
  snapshot: BatterySnapshot | undefined,
) {
  return Boolean(
    provisioned &&
    configuration?.showBatteryStatus &&
    snapshot?.available,
  );
}

export function batteryStatusText(snapshot: Extract<BatterySnapshot, { available: true }>) {
  return `${snapshot.level}%${snapshot.charging ? " Charging" : ""}`;
}

export function defaultBatteryVisibility(deviceType: DeviceConfiguration["deviceType"], explicit?: boolean) {
  return explicit ?? deviceType === "KIOSK_TABLET";
}
