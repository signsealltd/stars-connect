import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  authorised: true,
  device: {
    id: "device-1",
    name: "Synthetic tablet",
    tokenHash: "a".repeat(64),
    status: "ACTIVE" as const,
    deviceType: "KIOSK_TABLET" as "KIOSK_TABLET" | "MANAGER_DESKTOP",
    showBatteryStatus: true,
    appVersion: "1.0.0",
    batteryLevel: null,
    batteryCharging: null,
    batteryUpdatedAt: null,
    lastSeenAt: new Date(),
    lastSyncAt: new Date(),
    syncRequestedAt: null,
    pendingEventCount: 0,
    currentCursor: 0n,
    tokenRotatedAt: new Date(),
    revokedAt: null,
    isSeedData: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}));

vi.mock("@/lib/security", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/security")>();
  return {
    ...actual,
    requireRole: vi.fn(async () => {
      if (!state.authorised) throw new actual.AccessError(403, "FORBIDDEN");
      return {
        id: "admin-1",
        name: "Synthetic administrator",
        email: "admin@example.test",
        role: "ADMINISTRATOR",
        active: true,
        permissionOverrides: null,
      };
    }),
  };
});

vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/device-provisioning", () => ({
  placeholderCredentialHash: () => "p".repeat(64),
  issueSetupCode: vi.fn(async () => ({
    setupCode: "12345678",
    expiresAt: new Date("2026-07-29T12:15:00Z"),
  })),
}));
vi.mock("@/lib/device-auth", () => ({
  authenticateDevice: vi.fn(async () => state.device),
}));
vi.mock("@/lib/prisma", () => {
  const device = {
    findMany: vi.fn(async () => [state.device]),
    findUnique: vi.fn(async () => ({ ...state.device })),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...state.device, ...data })),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(state.device, data);
      return { ...state.device };
    }),
  };
  const tx = { device };
  return {
    prisma: {
      device,
      appSetting: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});

import { POST as provisionDevice } from "@/app/api/devices/route";
import { PATCH as updateDevice } from "@/app/api/devices/[id]/route";
import { GET as getKioskConfiguration } from "@/app/api/kiosk/screensaver/route";
import { audit } from "@/lib/audit";

beforeEach(() => {
  state.authorised = true;
  state.device.deviceType = "KIOSK_TABLET";
  state.device.showBatteryStatus = true;
});

describe("device battery configuration API", () => {
  it("defaults new kiosk devices on and manager desktops off", async () => {
    const kioskResponse = await provisionDevice(new NextRequest("https://app.starsconnect.co.uk/api/devices", {
      method: "POST",
      body: JSON.stringify({ name: "Kiosk", deviceType: "KIOSK_TABLET" }),
    }));
    expect((await kioskResponse.json()).device.showBatteryStatus).toBe(true);

    const desktopResponse = await provisionDevice(new NextRequest("https://app.starsconnect.co.uk/api/devices", {
      method: "POST",
      body: JSON.stringify({ name: "Office PC", deviceType: "MANAGER_DESKTOP" }),
    }));
    expect((await desktopResponse.json()).device.showBatteryStatus).toBe(false);
  });

  it("allows an administrator to disable and enable the option", async () => {
    const disable = await updateDevice(new NextRequest("https://app.starsconnect.co.uk/api/devices/device-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "settings", deviceType: "KIOSK_TABLET", showBatteryStatus: false }),
    }), { params: Promise.resolve({ id: "device-1" }) });
    expect(disable.status).toBe(200);
    expect((await disable.json()).device.showBatteryStatus).toBe(false);
    expect(audit).toHaveBeenCalledWith("DEVICE_SETTINGS_CHANGED", expect.objectContaining({
      beforeValue: expect.objectContaining({ showBatteryStatus: true }),
      afterValue: expect.objectContaining({ showBatteryStatus: false }),
    }));

    const enable = await updateDevice(new NextRequest("https://app.starsconnect.co.uk/api/devices/device-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "settings", deviceType: "KIOSK_TABLET", showBatteryStatus: true }),
    }), { params: Promise.resolve({ id: "device-1" }) });
    expect((await enable.json()).device.showBatteryStatus).toBe(true);
  });

  it("rejects an unauthorised direct update with 403", async () => {
    state.authorised = false;
    const response = await updateDevice(new NextRequest("https://app.starsconnect.co.uk/api/devices/device-1", {
      method: "PATCH",
      body: JSON.stringify({ action: "settings", deviceType: "KIOSK_TABLET", showBatteryStatus: false }),
    }), { params: Promise.resolve({ id: "device-1" }) });
    expect(response.status).toBe(403);
  });

  it("returns the authoritative setting in kiosk configuration", async () => {
    state.device.showBatteryStatus = false;
    const response = await getKioskConfiguration(new NextRequest("https://app.starsconnect.co.uk/api/kiosk/screensaver", {
      headers: { "x-device-id": "device-1", authorization: "Bearer synthetic" },
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).deviceConfiguration).toEqual({
      deviceType: "KIOSK_TABLET",
      showBatteryStatus: false,
    });
  });
});
