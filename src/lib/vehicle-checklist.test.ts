import {describe,it,expect} from "vitest";
import {checklist,validateCheck,validTransition,vehicleConfigSchema,registrationKey,type Submission} from "./vehicle-checklist";
import {CAPABILITIES,hasCapability} from "./permission-catalog";
const vehicle={fuelType:"DIESEL",config:vehicleConfigSchema.parse({}),mileage:100,status:"ACTIVE"};
function input():Submission{return {id:crypto.randomUUID(),vehicleId:crypto.randomUUID(),clientStartedAt:"2026-01-01T09:00:00.000Z",mileage:101,version:"FLOWER-1",initialImageId:crypto.randomUUID(),declaration:true,answers:checklist(vehicle.fuelType,vehicle.config).flatMap(s=>s.items).map(i=>({key:i.key,response:i.applicable?"PASS":"NA",notes:"",imageIds:[],secured:false}))}}
describe("vehicle check safety rules",()=>{
 it("accepts a complete all-pass check",()=>expect(validateCheck(input(),vehicle).outcome).toBe("PASSED"));
 it("rejects incomplete and duplicate answers",()=>{const p=input();p.answers.pop();expect(()=>validateCheck(p,vehicle)).toThrow("Complete");const d=input();d.answers[1]=d.answers[0];expect(()=>validateCheck(d,vehicle)).toThrow("Complete")});
 it("does not allow N/A on required checks",()=>{const p=input();p.answers[0].response="NA";expect(()=>validateCheck(p,vehicle)).toThrow("answer")});
 it("requires defect text, severity and evidence",()=>{const p=input();p.answers[0].response="DEFECT";expect(()=>validateCheck(p,vehicle)).toThrow("photograph")});
 it.each([['MINOR','MINOR_DEFECTS'],['CRITICAL','UNSAFE']] as const)("calculates %s outcome",(severity,outcome)=>{const p=input();p.answers[0]={...p.answers[0],response:"DEFECT",severity,notes:"Warning",imageIds:[crypto.randomUUID()]};expect(validateCheck(p,vehicle).outcome).toBe(outcome)});
 it("applies configured stop-use rules on the server",()=>{const p=input();p.answers[0]={...p.answers[0],response:"DEFECT",severity:"MINOR",notes:"Fuel gauge issue",imageIds:[crypto.randomUUID()]};expect(validateCheck(p,{...vehicle,config:{...vehicle.config,stopUse:["fuel"]}}).outcome).toBe("UNSAFE")});
 it("never clears an existing out-of-service status",()=>expect(validateCheck(input(),{...vehicle,status:"OUT_OF_SERVICE"}).outcome).toBe("UNSAFE"));
 it("blocks lower mileage",()=>{const p=input();p.mileage=99;expect(()=>validateCheck(p,vehicle)).toThrow("Mileage")});
 it("blocks archived selections",()=>expect(()=>validateCheck(input(),{...vehicle,status:"ARCHIVED"})).toThrow("archived"));
 it("configures electric, spare and wheelchair checks",()=>{const items=checklist("ELECTRIC",{...vehicle.config,spare:true,wheelchair:true}).flatMap(s=>s.items);expect(items.find(i=>i.key==="oil")?.applicable).toBe(false);expect(items.find(i=>i.key==="ramp")?.applicable).toBe(true);expect(items.find(i=>i.key==="wheel4-tread")?.applicable).toBe(true)});
 it("normalises registration comparisons",()=>expect(registrationKey("ab12 cde")).toBe("AB12CDE"));
 it("prevents skipped repair/verification transitions",()=>{expect(validTransition("REPORTED","CLOSED","done")).toBe(false);expect(validTransition("REPAIRED","VERIFIED","")).toBe(false);expect(validTransition("NO_FAULT","VERIFIED","Competent check found no fault")).toBe(true)});
 it.each(["CARE_ASSISTANT","TEAM_LEADER"] as const)("restricts %s to checks",role=>{expect(hasCapability(role,CAPABILITIES.VEHICLE_CHECK)).toBe(true);expect(hasCapability(role,CAPABILITIES.FLEET_MANAGE)).toBe(false);expect(hasCapability(role,CAPABILITIES.FLEET_RETURN)).toBe(false)});
 it("honours explicit restrictions",()=>expect(hasCapability("MANAGER",CAPABILITIES.FLEET_RETURN,{"fleet.return":false})).toBe(false));
});
