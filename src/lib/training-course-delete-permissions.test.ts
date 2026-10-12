import {beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>({session:null as null|{user:{id:string;role:string;permissionOverrides:object}},transaction:vi.fn()}));
vi.mock("./security",async original=>({...await original<typeof import("./security")>(),getSession:async()=>state.session}));
vi.mock("./audit",()=>({audit:vi.fn()}));
vi.mock("./prisma",()=>({prisma:{$transaction:state.transaction}}));
import {POST} from "@/app/api/training/configuration/route";
const request=(origin?:string)=>new NextRequest("http://localhost/api/training/configuration",{method:"POST",headers:origin?{origin}:{},body:JSON.stringify({action:"delete-courses",ids:["0191b0ea-d4b8-48ca-ae5f-8ec270b44763"]})});
beforeEach(()=>{vi.clearAllMocks();state.session=null;});
it("denies unauthenticated course deletion before accessing the catalogue",async()=>{
 expect((await POST(request())).status).toBe(401);expect(state.transaction).not.toHaveBeenCalled();
});
it("denies course deletion without training management permission",async()=>{
 state.session={user:{id:"staff",role:"CARE_ASSISTANT",permissionOverrides:{}}};
 expect((await POST(request())).status).toBe(403);expect(state.transaction).not.toHaveBeenCalled();
});
it("rejects cross-origin deletion even for an administrator",async()=>{
 state.session={user:{id:"admin",role:"ADMIN",permissionOverrides:{}}};
 expect((await POST(request("https://untrusted.example"))).status).toBe(403);expect(state.transaction).not.toHaveBeenCalled();
});
