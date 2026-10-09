import {beforeEach,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>({allowed:true,find:vi.fn(),update:vi.fn(),requests:vi.fn(),requestUpdate:vi.fn(),event:vi.fn(),audit:vi.fn()}));
vi.mock("@/lib/api",()=>({withCapability:async(_r:unknown,_c:unknown,fn:(actor:{id:string;organisationId:string;role:string;permissionOverrides:object})=>Promise<Response>)=>state.allowed?fn({id:"actor",organisationId:"org",role:"MANAGER",permissionOverrides:{}}):Response.json({error:"Forbidden"},{status:403}),jsonError:(error:string,status:number)=>Response.json({error},{status})}));
vi.mock("@/lib/compliance-service",()=>({requireOrganisation:()=>"org"}));
vi.mock("@/lib/action-notifications",()=>({jsonValue:(value:unknown)=>JSON.parse(JSON.stringify(value))}));
vi.mock("@/lib/prisma",()=>{const tx={staffScheduleException:{findFirst:state.find,updateMany:state.update},staffRequest:{findMany:state.requests,update:state.requestUpdate},staffRequestEvent:{create:state.event},auditLog:{create:state.audit}};return {prisma:{$transaction:async(fn:(client:typeof tx)=>Promise<unknown>)=>fn(tx)}}});
import {staffAbsenceTypes} from "./staff-absence-types";
import {PATCH} from "@/app/api/calendar/absences/route";
const id="11111111-1111-4111-8111-111111111111",staffId="22222222-2222-4222-8222-222222222222",updatedAt="2026-10-08T12:00:00.000Z";
const values={staffId,type:"SICKNESS",startDate:"2026-02-02",endDate:"2026-02-04",notes:"Corrected record",bradfordExcluded:true,bradfordReason:"Agreed adjustment"};
const req=(body:unknown)=>new NextRequest("http://localhost/api/calendar/absences",{method:"PATCH",body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();state.allowed=true;state.find.mockResolvedValue({id,staffId,type:"SICKNESS",updatedAt:new Date(updatedAt),startDate:new Date("2026-02-02"),endDate:new Date("2026-02-03")});state.update.mockResolvedValue({count:1});state.requests.mockResolvedValue([{id:"request",details:{startDate:"2026-02-02",endDate:"2026-02-03",selfCertification:"Private original",actualReturn:"2026-02-04"}}]);});
it("requires absence-management permission",async()=>{state.allowed=false;expect((await PATCH(req({id,updatedAt,reason:"Correction",values}))).status).toBe(403);expect(state.update).not.toHaveBeenCalled()});
it("scopes edits to approved absence records in the current organisation",async()=>{state.find.mockResolvedValue(null);expect((await PATCH(req({id,updatedAt,reason:"Correction",values}))).status).toBe(404);expect(state.find).toHaveBeenCalledWith({where:{id,organisationId:"org",type:{in:[...staffAbsenceTypes]},approvalStatus:"APPROVED"}});expect(state.update).not.toHaveBeenCalled()});
it("rejects stale edits without changing the linked request",async()=>{expect((await PATCH(req({id,updatedAt:"2026-01-01T00:00:00.000Z",reason:"Correction",values}))).status).toBe(409);expect(state.update).not.toHaveBeenCalled();expect(state.requestUpdate).not.toHaveBeenCalled()});
it("does not allow moving an absence to another employee",async()=>{expect((await PATCH(req({id,updatedAt,reason:"Correction",values:{...values,staffId:id}}))).status).toBe(422);expect(state.update).not.toHaveBeenCalled()});
it("updates the absence and linked request and retains audited before/after values",async()=>{expect((await PATCH(req({id,updatedAt,reason:"Correct date",values}))).status).toBe(200);expect(state.update).toHaveBeenCalledWith(expect.objectContaining({where:{id,updatedAt:new Date(updatedAt),approvalStatus:"APPROVED"},data:expect.objectContaining({endDate:new Date("2026-02-04"),bradfordExcluded:true})}));expect(state.requestUpdate).toHaveBeenCalledWith({where:{id:"request"},data:{details:expect.objectContaining({selfCertification:"Private original",endDate:"2026-02-04",actualReturn:"2026-02-05"})}});expect(state.audit).toHaveBeenCalledWith({data:expect.objectContaining({action:"STAFF_ABSENCE_UPDATED",beforeValue:expect.objectContaining({id}),afterValue:expect.objectContaining({reason:"Correct date"})})});
});
it("requires a cancellation reason and synchronises cancelled requests",async()=>{expect((await PATCH(req({id,updatedAt,reason:""}))).status).toBe(422);expect((await PATCH(req({id,updatedAt,reason:"Duplicate"}))).status).toBe(200);expect(state.update).toHaveBeenCalledWith(expect.objectContaining({data:{approvalStatus:"REJECTED"}}));expect(state.requestUpdate).toHaveBeenCalledWith({where:{id:"request"},data:{status:"CANCELLED"}})});
it("stops if another edit wins the version check",async()=>{state.update.mockResolvedValue({count:0});expect((await PATCH(req({id,updatedAt,reason:"Correction",values}))).status).toBe(409);expect(state.audit).not.toHaveBeenCalled();expect(state.requestUpdate).not.toHaveBeenCalled()});

it.each(["UNPAID_LEAVE","COMPASSIONATE_LEAVE"])("edits and cancels %s records",async type=>{
 state.find.mockResolvedValue({id,staffId,type,updatedAt:new Date(updatedAt)});
 expect((await PATCH(req({id,updatedAt,reason:"Correct dates",values:{...values,type,bradfordExcluded:false,bradfordReason:""}}))).status).toBe(200);
 expect(state.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({endDate:new Date("2026-02-04"),bradfordExcluded:false})}));
 expect((await PATCH(req({id,updatedAt,reason:"Cancelled"}))).status).toBe(200);
});
