import {beforeEach,describe,expect,it,vi} from "vitest";
import type {User} from "@prisma/client";
const state=vi.hoisted(()=>({value:undefined as unknown,find:vi.fn()}));
vi.mock("./prisma",()=>({prisma:{appSetting:{findUnique:state.find}}}));
import {applyVehicleUserAccess} from "./vehicle-user-access";
import {CAPABILITIES,hasCapability} from "./permission-catalog";
beforeEach(()=>{state.find.mockReset();state.find.mockImplementation(async()=>state.value===undefined?null:{value:state.value})});
describe("individual vehicle check access",()=>{
 const user=(role="TEAM_LEADER")=>({id:"person",role,permissionOverrides:{"vehicle.check":true,"fleet.manage":false}} as unknown as User);
 it("denies check access until explicitly enabled even when the grade grants it",async()=>{state.value=undefined;const u=await applyVehicleUserAccess(user());expect(hasCapability(u.role,CAPABILITIES.VEHICLE_CHECK,u.permissionOverrides)).toBe(false)});
 it("grants only vehicle checks without granting fleet management",async()=>{state.value=true;const u=await applyVehicleUserAccess(user());expect(hasCapability(u.role,CAPABILITIES.VEHICLE_CHECK,u.permissionOverrides)).toBe(true);expect(hasCapability(u.role,CAPABILITIES.FLEET_MANAGE,u.permissionOverrides)).toBe(false);expect(state.find).toHaveBeenCalledWith({where:{key:"vehicleCheckAccess:person"}})});
 it("takes revocation into account on the next request",async()=>{state.value=true;const u=await applyVehicleUserAccess(user());state.value=false;await applyVehicleUserAccess(u);expect(hasCapability(u.role,CAPABILITIES.VEHICLE_CHECK,u.permissionOverrides)).toBe(false)});
 it("never restricts administrators",async()=>{state.value=false;const u=await applyVehicleUserAccess(user("ADMINISTRATOR"));expect(hasCapability(u.role,CAPABILITIES.VEHICLE_CHECK,u.permissionOverrides)).toBe(true);expect(state.find).not.toHaveBeenCalled()});
});
