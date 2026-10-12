import {afterEach,beforeEach,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>({sync:vi.fn()}));
vi.mock("./ihasco-service",()=>({scheduledIhascoSync:state.sync}));
import {POST} from "@/app/api/cron/ihasco/route";
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("REPORT_JOB_SECRET","synthetic-scheduler-secret");});
afterEach(()=>vi.unstubAllEnvs());
const request=(token?:string)=>new NextRequest("http://localhost/api/cron/ihasco",{method:"POST",headers:token?{authorization:`Bearer ${token}`}:{}});
it("rejects missing or incorrect scheduler credentials without starting sync",async()=>{
  expect((await POST(request())).status).toBe(401);
  expect((await POST(request("wrong"))).status).toBe(401);
  expect(state.sync).not.toHaveBeenCalled();
});
it("reports partial results as retryable to the scheduler",async()=>{
  state.sync.mockResolvedValue({ok:false,counts:{failed:1}});
  expect((await POST(request("synthetic-scheduler-secret"))).status).toBe(503);
});
it("leaves initial import pending manager review",async()=>{
  state.sync.mockResolvedValue({status:"AWAITING_MANAGER_PREVIEW"});
  const result=await POST(request("synthetic-scheduler-secret"));
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({status:"AWAITING_MANAGER_PREVIEW"});
});
