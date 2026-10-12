import {beforeEach,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>({allowed:false,test:vi.fn(),integration:vi.fn()}));
vi.mock("./permissions",async original=>{const actual=await original<typeof import("./permissions")>();return {...actual,requireCapability:async(cap:string)=>{if(!state.allowed||cap!==actual.CAPABILITIES.TRAINING_MANAGE){const {AccessError}=await import("./security");throw new AccessError(403,"FORBIDDEN");}return {id:"manager",organisationId:"org"};}};});
vi.mock("./audit",()=>({audit:vi.fn()}));
vi.mock("./ihasco-service",()=>({ihConfigurationReady:()=>true,ihIntegration:state.integration,ihStatus:vi.fn(),ihTest:state.test,ihPreview:vi.fn(),ihMap:vi.fn(),ihSync:vi.fn()}));
import {POST} from "@/app/api/training/ihasco/route";
import {RequestError} from "./request-error";
beforeEach(()=>{vi.clearAllMocks();state.allowed=false;state.integration.mockResolvedValue({id:"integration"});state.test.mockResolvedValue({ok:true,codes:[]});});
it("requires training management permission before testing or reading the integration",async()=>{
  const result=await POST(new NextRequest("http://localhost/api/training/ihasco",{method:"POST",body:JSON.stringify({action:"test"})}));expect(result.status).toBe(403);expect(state.integration).not.toHaveBeenCalled();expect(state.test).not.toHaveBeenCalled();
});
it("returns only safe connection information for an authorised manager",async()=>{
  state.allowed=true;const result=await POST(new NextRequest("http://localhost/api/training/ihasco",{method:"POST",body:JSON.stringify({action:"test"})}));expect(result.status).toBe(200);expect(await result.json()).toEqual({ok:true,codes:[]});expect(state.test).toHaveBeenCalledWith({id:"integration"},"manager");
});
it("rejects another organisation before any provider operation",async()=>{
  state.allowed=true;state.integration.mockRejectedValue(new RequestError("Different organisation",403));const result=await POST(new NextRequest("http://localhost/api/training/ihasco",{method:"POST",body:JSON.stringify({action:"test"})}));expect(result.status).toBe(403);expect(state.test).not.toHaveBeenCalled();
});
it("rejects a cross-origin management mutation",async()=>{
  state.allowed=true;const result=await POST(new NextRequest("http://localhost/api/training/ihasco",{method:"POST",headers:{origin:"https://attacker.invalid"},body:JSON.stringify({action:"test"})}));expect(result.status).toBe(403);expect(state.test).not.toHaveBeenCalled();
});
