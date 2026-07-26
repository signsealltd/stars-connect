import { describe,expect,it } from "vitest";
import { DEVICE_SETUP_CODE_TTL_MS,deviceOperationalStatus,setupCodeIsUsable } from "./devices";
import { newSetupCode } from "./device-provisioning";
describe("device operational status",()=>{
 it("treats a newly provisioned device that has not connected yet as active",()=>expect(deviceOperationalStatus({status:"ACTIVE",lastSeenAt:null},new Date("2026-07-26T12:00:00Z"))).toBe("ACTIVE"));
 it("marks an active device stale after fifteen minutes",()=>expect(deviceOperationalStatus({status:"ACTIVE",lastSeenAt:"2026-07-26T11:44:59Z"},new Date("2026-07-26T12:00:00Z"))).toBe("STALE"));
 it("keeps a recently seen device active",()=>expect(deviceOperationalStatus({status:"ACTIVE",lastSeenAt:"2026-07-26T11:50:00Z"},new Date("2026-07-26T12:00:00Z"))).toBe("ACTIVE"));
 it("reports revoked regardless of last seen time",()=>expect(deviceOperationalStatus({status:"REVOKED",lastSeenAt:"2026-07-26T11:59:00Z"},new Date("2026-07-26T12:00:00Z"))).toBe("REVOKED"));
});
describe("one-time setup codes",()=>{
 it("generates an easier cryptographically random eight-digit code",()=>{for(let i=0;i<20;i++)expect(newSetupCode()).toMatch(/^\d{8}$/)});
 it("uses a fifteen minute lifetime",()=>expect(DEVICE_SETUP_CODE_TTL_MS).toBe(15*60_000));
 it("accepts only unconsumed unexpired codes",()=>{const now=new Date("2026-07-26T12:00:00Z");expect(setupCodeIsUsable({expiresAt:"2026-07-26T12:01:00Z",consumedAt:null},now)).toBe(true);expect(setupCodeIsUsable({expiresAt:"2026-07-26T11:59:59Z",consumedAt:null},now)).toBe(false);expect(setupCodeIsUsable({expiresAt:"2026-07-26T12:01:00Z",consumedAt:"2026-07-26T11:58:00Z"},now)).toBe(false)});
});