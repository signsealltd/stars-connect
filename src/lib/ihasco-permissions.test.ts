import {beforeEach,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const state=vi.hoisted(()=>({allowed:false,test:vi.fn(),integration:vi.fn(),confirm:vi.fn(),catalogue:vi.fn()}));
vi.mock("./permissions",async original=>{const actual=await original<typeof import("./permissions")>();return {...actual,requireCapability:async(cap:string)=>{if(!state.allowed||cap!==actual.CAPABILITIES.TRAINING_MANAGE){const {AccessError}=await import("./security");throw new AccessError(403,"FORBIDDEN");}return {id:"manager",organisationId:"org"};}};});
vi.mock("./audit",()=>({audit:vi.fn()}));
vi.mock("./ihasco-service",()=>({ihConfigurationReady:()=>true,ihIntegration:state.integration,ihStatus:vi.fn(),ihTest:state.test,ihPreview:vi.fn(),ihMap:vi.fn(),ihSync:vi.fn(),ihConfirmCourseProposal:state.confirm,ihImportCatalogue:state.catalogue}));
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
it("requires a manager and a reviewed proposal token for bulk course confirmation",async()=>{
  const token="a".repeat(64),request=()=>new NextRequest("http://localhost/api/training/ihasco",{method:"POST",body:JSON.stringify({action:"confirm-course-proposal",token})});
  expect((await POST(request())).status).toBe(403);expect(state.confirm).not.toHaveBeenCalled();
  state.allowed=true;state.confirm.mockResolvedValue({ok:true,confirmed:39});
  expect((await POST(request())).status).toBe(200);
  expect(state.confirm).toHaveBeenCalledWith({id:"integration"},token,"manager");
});
it("requires management permission and explicit confirmation for a training reset",async()=>{
  const token="a".repeat(64),request=(confirmation?:string)=>new NextRequest("http://localhost/api/training/ihasco",{method:"POST",body:JSON.stringify({action:"reset-catalogue",token,confirmation})});
  expect((await POST(request("RESET TRAINING"))).status).toBe(403);
  state.allowed=true;
  expect((await POST(request())).status).toBe(422);expect(state.catalogue).not.toHaveBeenCalled();
  state.catalogue.mockResolvedValue({ok:true,catalogueChanged:true});
  expect((await POST(request("RESET TRAINING"))).status).toBe(200);
  expect(state.catalogue).toHaveBeenCalledWith({id:"integration"},token,"manager",true);
});
