import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
describe("dashboard device synchronisation control",()=>{
 it("requests remote kiosk sync and refreshes until devices respond",()=>{
  const dashboard=source("src/app/dashboard/page.tsx");
  expect(dashboard).toContain('fetch("/api/devices/sync-request",{method:"POST"})');
  expect(dashboard).toContain("onClick={()=>void forceSync()}");
  expect(dashboard).toContain('forcingSync?"Synchronising…":"Force sync"');
  expect(dashboard).toContain("device.syncPending");
  expect(dashboard).toContain("setLastUpdated(new Date())");
 });
 it("records sync requests and allows authenticated kiosks to read them",()=>{
  const route=source("src/app/api/devices/sync-request/route.ts");
  expect(route).toContain('withRole(req,"RECEPTION"');
  expect(route).toContain('audit("DEVICE_SYNC_REQUESTED"');
  expect(route).toContain('status:"ACTIVE",isSeedData:false');
 });
});