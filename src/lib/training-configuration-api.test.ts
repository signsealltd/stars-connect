import {beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>({lookup:vi.fn(),update:vi.fn(),create:vi.fn(),providerCreate:vi.fn(),linksDelete:vi.fn(),linksCreate:vi.fn(),audit:vi.fn()}));
vi.mock("@/lib/api",()=>({withRole:async(_req:unknown,_role:unknown,handler:(user:{id:string})=>Promise<Response>)=>handler({id:"actor"}),jsonError:(error:string,status:number)=>Response.json({error},{status}),requestContext:()=>({})}));
vi.mock("@/lib/audit",()=>({audit:state.audit}));
vi.mock("@/lib/prisma",()=>{const client={trainingCourse:{findUnique:state.lookup,update:state.update,create:state.create},trainingProvider:{create:state.providerCreate},trainingCourseProvider:{deleteMany:state.linksDelete,createMany:state.linksCreate}};return {prisma:{...client,$transaction:async(fn:(tx:typeof client)=>Promise<unknown>)=>fn(client)}}});
import {POST} from "@/app/api/training/configuration/route";
const id="0191b0ea-d4b8-48ca-ae5f-8ec270b44763";
const input={kind:"course",id,name:"GDPR 1 (Careskills)",category:"STARS proposed training plan",numberedLevel:null,priority:"Immediate",evidenceKind:"THEORY",renewalMonths:null,requirementRules:{"Support Worker":"REQUIRED","Team Leader":"CONDITIONAL",Manager:"OPTIONAL"},providerIds:[]};
const request=(body:unknown)=>new NextRequest("http://localhost/api/training/configuration",{method:"POST",body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();state.lookup.mockResolvedValue({id,evidenceKind:"THEORY"});state.update.mockImplementation(async({data})=>({id,...data}));state.create.mockImplementation(async({data})=>({id,...data}));state.providerCreate.mockImplementation(async({data})=>({id,...data}));});
it("saves editable proposed requirements for only the CSV's three roles without inventing expiry or Atlas IDs",async()=>{
  const response=await POST(request(input));expect(response.status).toBe(200);
  const saved=state.update.mock.calls[0][0].data;
  expect(saved.requirementRules).toEqual(input.requirementRules);expect(saved.renewalMonths).toBeNull();expect(saved.numberedLevel).toBeNull();expect(saved).not.toHaveProperty("atlasCourseId");expect(saved).not.toHaveProperty("kind");
});
it("accepts induction and rejects invented numbered levels",async()=>{
  expect((await POST(request({...input,requirementRules:{"Support Worker":"INDUCTION"}}))).status).toBe(200);
  state.update.mockClear();expect((await POST(request({...input,numberedLevel:1}))).status).toBe(422);expect(state.update).not.toHaveBeenCalled();
});
it("does not convert existing theory completions into full Tier 2 evidence",async()=>{
  expect((await POST(request({...input,evidenceKind:"FULL_TIER2"}))).status).toBe(422);expect(state.update).not.toHaveBeenCalled();
});
it("keeps a protected practical course separate when editing its requirements",async()=>{
  state.lookup.mockResolvedValue({id,evidenceKind:"COURSE"});
  expect((await POST(request({...input,name:"Medication Practical Competency",evidenceKind:"COURSE"}))).status).toBe(200);
  expect(state.update.mock.calls[0][0].data.evidenceKind).toBe("PRACTICAL");state.update.mockClear();
  expect((await POST(request({...input,name:"Medication Practical Competency",evidenceKind:"THEORY"}))).status).toBe(422);expect(state.update).not.toHaveBeenCalled();
});
it("saves a provider without passing the request discriminator to Prisma",async()=>{
  expect((await POST(request({kind:"provider",name:"Careskills"}))).status).toBe(201);
  expect(state.providerCreate.mock.calls[0][0].data).not.toHaveProperty("kind");
});
