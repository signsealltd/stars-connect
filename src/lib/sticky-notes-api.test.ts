import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>({userId:"alice",signedIn:true,rows:[] as Array<{id:string;userId:string;content:string;colour:string;updatedAt:Date}>}));
vi.mock("@/lib/audit",()=>({audit:vi.fn()}));
vi.mock("@/lib/permissions",async original=>{
 const actual=await original<typeof import("@/lib/permissions")>();
 return {...actual,requireCapability:async()=>{if(!state.signedIn){const {AccessError}=await import("@/lib/security");throw new AccessError(401,"AUTHENTICATION_REQUIRED");}return {id:state.userId,role:"ADMINISTRATOR"};}};
});
vi.mock("@/lib/prisma",()=>({prisma:{stickyNote:{
 findMany:async({where}:{where:{userId:string}})=>state.rows.filter(row=>row.userId===where.userId),
 create:async({data}:{data:{userId:string;content:string;colour:string}})=>{const row={id:"33333333-3333-4333-8333-333333333333",...data,updatedAt:new Date()};state.rows.push(row);return row;},
 updateMany:async({where,data}:{where:{id:string;userId:string;updatedAt:Date};data:{content:string;colour:string}})=>{const row=state.rows.find(r=>r.id===where.id&&r.userId===where.userId&&r.updatedAt.getTime()===where.updatedAt.getTime());if(row)Object.assign(row,data);return {count:row?1:0};},
 deleteMany:async({where}:{where:{id:string;userId:string;updatedAt:Date}})=>{const prior=state.rows.length;state.rows=state.rows.filter(r=>!(r.id===where.id&&r.userId===where.userId&&r.updatedAt.getTime()===where.updatedAt.getTime()));return {count:prior-state.rows.length};},
}}}));
import {GET,POST,PATCH,DELETE} from "@/app/api/sticky-notes/route";
const id="22222222-2222-4222-8222-222222222222",timestamp="2026-09-20T12:00:00.000Z";
const request=(method:string,body?:unknown)=>new NextRequest("http://localhost/api/sticky-notes",{method,...(body?{body:JSON.stringify(body),headers:{"content-type":"application/json"}}:{})});
beforeEach(()=>{state.userId="alice";state.signedIn=true;state.rows=[{id,userId:"bob",content:"Bob's private note",colour:"yellow",updatedAt:new Date(timestamp)}];});
describe("private account notes",()=>{
 it("does not list another account's notes even for an administrator",async()=>{const response=await GET(request("GET"));expect(await response.json()).toEqual([]);expect(response.headers.get("cache-control")).toContain("no-store");});
 it("takes ownership from the session instead of the submitted account",async()=>{expect((await POST(request("POST",{content:"My reminder",colour:"green",userId:"bob"}))).status).toBe(201);expect(state.rows[1].userId).toBe("alice");});
 it.each([PATCH,DELETE])("rejects attempts to mutate another user's note",async handler=>{const response=await handler(request(handler===PATCH?"PATCH":"DELETE",{id,updatedAt:timestamp,content:"Stolen",colour:"pink"}));expect(response.status).toBe(409);expect(state.rows[0].content).toBe("Bob's private note");});
 it("updates an owned note but rejects a stale edit",async()=>{state.userId="bob";expect((await PATCH(request("PATCH",{id,updatedAt:"2026-09-19T12:00:00.000Z",content:"Changed",colour:"blue"}))).status).toBe(409);expect((await PATCH(request("PATCH",{id,updatedAt:timestamp,content:"Changed",colour:"blue"}))).status).toBe(200);});
 it("requires a signed-in session",async()=>{state.signedIn=false;expect((await GET(request("GET"))).status).toBe(401);});
 it("rejects empty notes",async()=>{expect((await POST(request("POST",{content:"  "}))).status).toBe(422);});
});
