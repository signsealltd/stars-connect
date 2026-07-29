import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { KioskDeviceStatusContent } from "@/components/kiosk-device-status-bar";
import {
  defaultBatteryVisibility,
  shouldShowBatteryStatus,
  type DeviceConfiguration,
} from "./device-battery-display";
import type { BatterySnapshot } from "./battery-status";

const kiosk: DeviceConfiguration = { deviceType: "KIOSK_TABLET", showBatteryStatus: true };
const enabledBattery: BatterySnapshot = { available: true, level: 82, charging: false, updatedAt: "2026-07-29T12:00:00.000Z" };
const sync = { queued: 0, conflicts: 0, lastSync: "2026-07-29T12:46:26.000Z" };

describe("configurable battery display", () => {
  it("uses device-type provisioning defaults without screen-size inference", () => {
    expect(defaultBatteryVisibility("KIOSK_TABLET")).toBe(true);
    expect(defaultBatteryVisibility("MANAGER_DESKTOP")).toBe(false);
    expect(defaultBatteryVisibility("MANAGER_DESKTOP", true)).toBe(true);
  });

  it("hides battery when disabled or unsupported", () => {
    expect(shouldShowBatteryStatus(true, { ...kiosk, showBatteryStatus: false }, enabledBattery)).toBe(false);
    expect(shouldShowBatteryStatus(true, kiosk, { available: false, updatedAt: "2026-07-29T12:00:00.000Z" })).toBe(false);
    expect(renderToStaticMarkup(
      <KioskDeviceStatusContent deviceName="Test device" configuration={{ ...kiosk, showBatteryStatus: false }} battery={enabledBattery} sync={sync}/>,
    )).not.toContain("Battery 82");
  });

  it("shows enabled supported charging and non-charging states", () => {
    const unplugged = renderToStaticMarkup(
      <KioskDeviceStatusContent deviceName="Test device" configuration={kiosk} battery={enabledBattery} sync={sync}/>,
    );
    const charging = renderToStaticMarkup(
      <KioskDeviceStatusContent deviceName="Test device" configuration={kiosk} battery={{ ...enabledBattery, charging: true }} sync={sync}/>,
    );
    expect(unplugged).toContain("82%");
    expect(unplugged).not.toContain("82% Charging");
    expect(charging).toContain("82% Charging");
  });

  it("renders a wrapping status bar without a reserved unavailable-battery placeholder", () => {
    const html = renderToStaticMarkup(
      <KioskDeviceStatusContent deviceName="Test device" configuration={kiosk} battery={{ available: false, updatedAt: "2026-07-29T12:00:00.000Z" }} sync={sync}/>,
    );
    expect(html).toContain("flex-wrap:wrap");
    expect(html).toContain("Last synced");
    expect(html).not.toContain("Battery unavailable");
  });

  it("uses only a restrained inline warning during emergency mode", () => {
    const html = renderToStaticMarkup(
      <KioskDeviceStatusContent
        deviceName="Test device"
        configuration={kiosk}
        battery={{ ...enabledBattery, level: 5 }}
        sync={sync}
        emergency
      />,
    );
    expect(html).toContain("kiosk-device-status-bar emergency");
    expect(html).toContain("battery-inline urgent");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("modal");
  });
});
