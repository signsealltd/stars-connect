import {beforeEach,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>({save:vi.fn(),audit:vi.fn()}));
vi.mock("./api",()=>({withRole:async(_r:unknown,_role:unknown,handler:(user:{id:string})=>Promise<unknown>)=>handler({id:"manager"}),jsonError:(error:string,status:number)=>Response.json({error},{status}),requestContext:()=>({})}));
vi.mock("./audit",()=>({audit:state.audit}));
vi.mock("./prisma",()=>({prisma:{staffMember:{findFirst:async()=>({id:"staff"})},trainingCourse:{findFirst:async()=>({id:"course"})},staffTrainingAssignment:{findUnique:async()=>null,upsert:state.save,deleteMany:vi.fn()}}}));
import {POST} from "@/app/api/training/assignments/route";
const request=(body:object)=>new NextRequest("http://localhost/api/training/assignments",{method:"POST",body:JSON.stringify({staffId:"0191b0ea-d4b8-48ca-ae5f-8ec270b44763",courseId:"1191b0ea-d4b8-48ca-ae5f-8ec270b44763",required:true,...body})});
beforeEach(()=>{vi.clearAllMocks();state.save.mockResolvedValue({id:"assignment"});});
it("persists and audits individual overrides on both create and update",async()=>{
 const policy={renewalOverrideMonths:6,reassessmentAfter:"2026-10-12",bookedFor:"2026-10-20"};
 expect((await POST(request({policy,reason:"Clinician-directed interval"}))).status).toBe(200);
 expect(state.save).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({policy}),update:expect.objectContaining({policy})}));
 expect(state.audit).toHaveBeenCalledWith("STAFF_TRAINING_ASSIGNMENT_UPDATED",expect.objectContaining({afterValue:expect.objectContaining({policy,reason:"Clinician-directed interval"})}));
});
it("requires a justification and never silently drops settings on role-default assignments",async()=>{
 expect((await POST(request({policy:{renewalOverrideMonths:6}}))).status).toBe(422);
 expect((await POST(request({required:null,policy:{bookedFor:"2026-10-20"}}))).status).toBe(422);
 expect(state.save).not.toHaveBeenCalled();
});
