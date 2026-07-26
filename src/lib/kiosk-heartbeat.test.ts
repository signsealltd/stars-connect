import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "src/components/service-worker-registration.tsx"), "utf8");
describe("kiosk device heartbeat", () => {
 it("periodically syncs only provisioned kiosk routes", () => {
  const runtime = source();
  expect(runtime).toContain("isKioskRoute(pathname)");
  expect(runtime).toContain("hasDeviceCredential(localStorage)");
  expect(runtime).toContain("window.setInterval(heartbeat,KIOSK_HEARTBEAT_MS)");
  expect(runtime).toContain("void syncNow()");
  expect(runtime).toContain("/api/devices/sync-request");
  expect(runtime).toContain("SYNC_REQUEST_POLL_MS");
 });
});
