import { describe, expect, it, vi } from "vitest";
import {
  BATTERY_STORAGE_KEY,
  batterySeverity,
  batterySyncHeaders,
  type BatteryManagerLike,
  type BatterySnapshot,
  watchBattery,
} from "./battery-status";

class FakeBattery implements BatteryManagerLike {
  level: number;
  charging: boolean;
  private listeners = new Map<string, Set<() => void>>();

  constructor(level: number, charging: boolean) {
    this.level = level;
    this.charging = charging;
  }

  addEventListener(type: "levelchange" | "chargingchange", listener: () => void) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: "levelchange" | "chargingchange", listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: "levelchange" | "chargingchange") {
    this.listeners.get(type)?.forEach(listener => listener());
  }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const fixedNow = () => new Date("2026-07-28T09:30:00.000Z");

describe("battery status", () => {
  it("reports the initial supported battery state", async () => {
    const battery = new FakeBattery(.82, false);
    const updates: BatterySnapshot[] = [];
    const cleanup = watchBattery({ getBattery: async () => battery }, value => updates.push(value), fixedNow);
    await tick();
    expect(updates).toEqual([{ available: true, level: 82, charging: false, updatedAt: fixedNow().toISOString() }]);
    cleanup();
  });

  it("uses a neutral unavailable state when the API is unsupported", () => {
    const updates: BatterySnapshot[] = [];
    watchBattery({}, value => updates.push(value), fixedNow);
    expect(updates).toEqual([{ available: false, updatedAt: fixedNow().toISOString() }]);
  });

  it("reports charging and suppresses low-battery severity while charging", async () => {
    const battery = new FakeBattery(.08, true);
    const updates: BatterySnapshot[] = [];
    const cleanup = watchBattery({ getBattery: async () => battery }, value => updates.push(value), fixedNow);
    await tick();
    expect(updates.at(-1)).toMatchObject({ available: true, level: 8, charging: true });
    expect(batterySeverity(updates.at(-1)!)).toBe("normal");
    cleanup();
  });

  it.each([
    [20, "low"],
    [10, "critical"],
    [5, "urgent"],
  ] as const)("maps %i percent to the %s warning", (level, severity) => {
    expect(batterySeverity({ available: true, level, charging: false, updatedAt: fixedNow().toISOString() })).toBe(severity);
  });

  it("updates from events and removes both listeners during cleanup", async () => {
    const battery = new FakeBattery(.55, false);
    const update = vi.fn();
    const cleanup = watchBattery({ getBattery: async () => battery }, update, fixedNow);
    await tick();
    battery.level = .19;
    battery.emit("levelchange");
    battery.charging = true;
    battery.emit("chargingchange");
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ level: 19, charging: true }));
    const calls = update.mock.calls.length;
    cleanup();
    battery.emit("levelchange");
    battery.emit("chargingchange");
    expect(update).toHaveBeenCalledTimes(calls);
  });

  it("adds optional battery health headers only for a valid available reading", () => {
    const value = JSON.stringify({ available: true, level: 64, charging: false, updatedAt: fixedNow().toISOString() });
    const storage = { getItem: (key: string) => key === BATTERY_STORAGE_KEY ? value : null };
    expect(batterySyncHeaders(storage)).toEqual({
      "x-battery-level": "64",
      "x-battery-charging": "false",
      "x-battery-updated-at": fixedNow().toISOString(),
    });
    expect(batterySyncHeaders({ getItem: () => null })).toEqual({});
  });
});
