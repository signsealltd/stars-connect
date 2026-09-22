import {beforeEach,describe,it,expect,vi} from "vitest";
import {NextRequest,NextResponse} from "next/server";
const state=vi.hoisted(()=>({view:true,record:true,mutate:vi.fn(),snapshot:vi.fn()}));
vi.mock("./api",()=>({jsonError:(error:string,status=400)=>NextResponse.json({error},{status}),withCapability:async(req:NextRequest,cap:string,fn:(user:unknown)=>Promise<unknown>)=>{if(req.headers.get("origin")!=="http://localhost")return NextResponse.json({error:"origin"},{status:403});if(!state.view)return NextResponse.json({error:"forbidden"},{status:403});return fn({id:"manager",name:"Manager",role:"MANAGER"})}}));
vi.mock("./permissions",()=>({CAPABILITIES:{PAYMENTS_VIEW:"payments.view",PAYMENTS_RECORD:"payments.record",PAYMENTS_REVERSE:"payments.reverse"},hasCapability:()=>state.record}));
vi.mock("./payments",async original=>({...await original<typeof import("./payments")>(),mutatePayments:state.mutate,paymentSnapshot:state.snapshot}));
import {POST} from "../app/api/payments/route";
const body={action:"PAY",items:[{id:"81ba759e-d965-49a4-9b9c-1f37a4c9bc55",revision:0}],amount:"12.34",receivedDate:"2026-01-01"};
const request=(value:unknown=body)=>new NextRequest("http://localhost/api/payments",{method:"POST",headers:{origin:"http://localhost","content-type":"application/json"},body:JSON.stringify(value)});
beforeEach(()=>{vi.clearAllMocks();state.view=true;state.record=true;state.mutate.mockResolvedValue({changed:["Invoice"]})});
describe("payments API access",()=>{
 it("denies requests without view access",async()=>{state.view=false;expect((await POST(request())).status).toBe(403);expect(state.mutate).not.toHaveBeenCalled()});
 it("denies record or reverse without the relevant capability",async()=>{state.record=false;for(const action of ["PAY","REVERSE"]){expect((await POST(request({...body,action,reason:"Mistake"}))).status).toBe(403)}expect(state.mutate).not.toHaveBeenCalled()});
 it("rejects invalid input before mutation",async()=>{expect((await POST(request({...body,amount:"-1"}))).status).toBe(422);expect(state.mutate).not.toHaveBeenCalled()});
 it("passes only validated actions and authenticated actor to service",async()=>{expect((await POST(request({...body,actorId:"attacker",organisationId:"other",total:"999"}))).status).toBe(200);expect(state.mutate).toHaveBeenCalledWith(body,expect.objectContaining({id:"manager"}));expect(state.mutate.mock.calls[0][0]).not.toHaveProperty("organisationId")});
});
