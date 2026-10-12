import {beforeEach,it,expect,vi} from "vitest";
import {NextRequest,NextResponse} from "next/server";
import path from "node:path";
const state=vi.hoisted(()=>({own:null as null|{staff:{id:string};user:{id:string;role:string;permissionOverrides:object}},manager:null as null|{user:{id:string;organisationId:string;role:string;permissionOverrides:object}},caps:new Set<string>(),sameOrganisation:true,normalOwner:false,read:vi.fn(),access:vi.fn(),lookup:vi.fn()}));
vi.mock("fs/promises",()=>({readFile:state.read,unlink:vi.fn()}));
vi.mock("./staff-area-auth",()=>({withStaff:vi.fn(),staffSession:async()=>state.own,staffHeaders:{"Cache-Control":"private, no-store"},staffJson:(data:unknown,status=200)=>NextResponse.json(data,{status})}));
vi.mock("./security",()=>({getSession:async()=>state.manager}));
vi.mock("./permissions",()=>({CAPABILITIES:{STAFF_TRAINING:"training",STAFF_HR_DOCUMENTS:"documents"},hasCapability:(_role:unknown,cap:string)=>state.caps.has(cap)}));
vi.mock("./prisma",()=>({prisma:{staffPrivateDocument:{findUnique:state.lookup},staffTrainingRecord:{findFirst:async()=>state.sameOrganisation?{id:"record"}:null},staffMember:{findFirst:async()=>state.normalOwner?{id:"owner"}:null},user:{findMany:async()=>[{id:"scoped-user"}]},staffAccessEvent:{create:state.access}}}));
import {GET} from "@/app/api/staff-area/documents/route";
const req=()=>new NextRequest("http://localhost/api/staff-area/documents?id=document&view=1");
beforeEach(()=>{vi.clearAllMocks();state.own=null;state.manager=null;state.caps=new Set();state.sameOrganisation=true;state.normalOwner=false;state.read.mockResolvedValue(Buffer.from("%PDF-1.4"));state.lookup.mockResolvedValue({id:"document",staffId:"owner",trainingRecordId:"record",request:null,requestId:null,expiresAt:new Date("2030-01-01"),storagePath:path.join(process.cwd(),".data","staff-private","test"),filename:"iHasco.pdf",mimeType:"application/pdf"});});
it("allows staff to view only their own certificate with training permission",async()=>{
  state.own={staff:{id:"owner"},user:{id:"staff-user",role:"CARE_ASSISTANT",permissionOverrides:{}}};state.caps.add("training");expect((await GET(req())).status).toBe(200);expect(state.read).toHaveBeenCalledOnce();
  state.own.staff.id="someone-else";state.read.mockClear();expect((await GET(req())).status).toBe(404);expect(state.read).not.toHaveBeenCalled();
});
it("denies unauthenticated and unpermitted certificate access",async()=>{
  expect((await GET(req())).status).toBe(404);state.own={staff:{id:"owner"},user:{id:"staff-user",role:"CARE_ASSISTANT",permissionOverrides:{}}};expect((await GET(req())).status).toBe(404);expect(state.read).not.toHaveBeenCalled();
});
it("requires manager document and training permissions within the organisation",async()=>{
  state.manager={user:{id:"manager",organisationId:"org",role:"MANAGER",permissionOverrides:{}}};state.caps.add("training");expect((await GET(req())).status).toBe(404);state.caps.add("documents");expect((await GET(req())).status).toBe(200);state.sameOrganisation=false;expect((await GET(req())).status).toBe(404);
});
it("supports own certificates through the existing normal-login staff portal",async()=>{
  state.manager={user:{id:"staff-user",organisationId:"org",role:"CARE_ASSISTANT",permissionOverrides:{}}};state.normalOwner=true;state.caps.add("training");const response=await GET(req());expect(response.status).toBe(200);expect(response.headers.get("content-disposition")).toContain("inline");expect(response.headers.get("cache-control")).toContain("no-store");
});
