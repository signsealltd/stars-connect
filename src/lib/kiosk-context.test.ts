import { describe,expect,it } from "vitest";
import { kioskSyncEligibility,safeSyncRejection,shouldLoadManagerPreferences,shouldRegisterServiceWorker } from "./kiosk-context";
import { workflowActions } from "./finance-workflow";
const storage=(values:Record<string,string>={})=>({getItem:(key:string)=>values[key]||null});
describe("kiosk synchronisation eligibility",()=>{
 it("allows a provisioned kiosk to synchronise",()=>expect(kioskSyncEligibility("/register",storage({"pulse-device-id":"tablet-1","pulse-device-token":"secret"}))).toEqual({allowed:true,category:"DEVICE_AUTHENTICATED"}));
 it("rejects an unprovisioned kiosk separately from user authentication",()=>expect(kioskSyncEligibility("/",storage())).toEqual({allowed:false,category:"DEVICE_UNPROVISIONED"}));
 it("does not start kiosk sync in an ordinary manager session",()=>expect(kioskSyncEligibility("/dashboard/payroll",storage())).toEqual({allowed:false,category:"MANAGER_ROUTE"}));
 it("keeps manager actions available when kiosk sync is unavailable",()=>{expect(kioskSyncEligibility("/dashboard/billing",storage()).allowed).toBe(false);expect(workflowActions("REQUIRES_REVIEW",2).review).toBe(true)});
});
describe("service worker and safe rejection policy",()=>{
 it("registers for kiosk routes but not an unprovisioned manager route",()=>{expect(shouldRegisterServiceWorker("/clock",storage())).toBe(true);expect(shouldRegisterServiceWorker("/dashboard",storage())).toBe(false)});
 it("keeps offline support when a provisioned tablet opens a manager route",()=>expect(shouldRegisterServiceWorker("/dashboard",storage({"pulse-device-id":"tablet-1","pulse-device-token":"secret"}))).toBe(true));
 it("maps failures to non-secret categories",()=>{expect(safeSyncRejection(401)).toBe("DEVICE_CREDENTIAL_REJECTED");expect(safeSyncRejection(400)).toBe("PAYLOAD_INVALID");expect(safeSyncRejection(500)).toBe("SERVER_UNAVAILABLE")});
 it("never loads manager preferences on kiosk routes",()=>{for(const route of["/","/clock","/register","/visitors","/emergency","/live","/offline","/setup"])expect(shouldLoadManagerPreferences(route)).toBe(false);expect(shouldLoadManagerPreferences("/dashboard")).toBe(true)});
});