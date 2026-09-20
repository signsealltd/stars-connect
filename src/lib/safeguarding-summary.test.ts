import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>({find:vi.fn(async()=>[]),counts:vi.fn(async({where}:{where:{status?:string}})=>where.status==="OPEN"?137:240)}));
vi.mock("@/lib/permissions",async original=>({...await original<typeof import("@/lib/permissions")>(),requireCapability:async()=>({id:"manager"})}));
vi.mock("@/lib/audit",()=>({audit:vi.fn()}));
vi.mock("@/lib/safeguarding-service",()=>({refreshSafeguarding:async()=>({mode:"ACCUMULATED",windowDays:0})}));
vi.mock("@/lib/prisma",()=>({prisma:{safeguardingEnquiry:{findMany:state.find,count:state.counts},student:{findMany:async()=>[]}}}));
import {GET} from "@/app/api/safeguarding/route";
beforeEach(()=>{state.find.mockClear();state.counts.mockClear();});
describe("safeguarding trigger summary",()=>{
 it("counts all open enquiries without fetching a capped list",async()=>{const response=await GET(new NextRequest("http://localhost/api/safeguarding?summary=true"));expect((await response.json()).openCount).toBe(137);expect(state.find).not.toHaveBeenCalled();});
 it("keeps the open count separate from closed history and pages review rows",async()=>{const response=await GET(new NextRequest("http://localhost/api/safeguarding?history=true&page=2"));expect(await response.json()).toMatchObject({openCount:137,total:240,page:2});expect(state.find).toHaveBeenCalledWith(expect.objectContaining({skip:25,take:25,where:{}}));});
});
