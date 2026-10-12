import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const mocks=vi.hoisted(()=>({sync:vi.fn(),report:vi.fn()}));
vi.mock("./ihasco-service",()=>({scheduledIhascoSync:mocks.sync}));
vi.mock("./scheduled-reports",()=>({runScheduledDailyReport:mocks.report}));
vi.mock("./prisma",()=>({prisma:{user:{findFirst:async()=>null}}}));
vi.mock("./safety-reminders",()=>({syncSafetyTasks:vi.fn()}));
vi.mock("./medication-service",()=>({refreshMedications:vi.fn()}));
vi.mock("./funded-billing-service",()=>({prepareMonthlyBilling:vi.fn()}));
vi.mock("./safeguarding-service",()=>({refreshSafeguarding:vi.fn()}));
vi.mock("./audit-retention",()=>({enforceAuditRetention:vi.fn()}));
vi.mock("./rate-limit",()=>({rateLimit:()=>({allowed:true})}));
import {POST} from "@/app/api/internal/reports/daily/run/route";
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("REPORT_JOB_SECRET","test-job-secret");mocks.report.mockResolvedValue({ok:true,status:"SUCCESS"});});
afterEach(()=>vi.unstubAllEnvs());
const request=(token="test-job-secret")=>new NextRequest("https://example.test/api/internal/reports/daily/run",{method:"POST",headers:{authorization:`Bearer ${token}`}});
it("runs iHasco through the authenticated daily job",async()=>{
 mocks.sync.mockResolvedValue({ok:true,counts:{imported:2}});
 const response=await POST(request());expect(response.status).toBe(200);expect(mocks.sync).toHaveBeenCalledOnce();expect(await response.json()).toMatchObject({ihasco:{ok:true,counts:{imported:2}}});
});
it("reports iHasco failures without changing successful report delivery",async()=>{
 mocks.sync.mockResolvedValue({status:"FAILED",error:"Provider unavailable"});
 const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).toMatchObject({ok:true,ihasco:{status:"FAILED"}});
});
it("never starts iHasco for an unauthorised daily request",async()=>{
 expect((await POST(request("wrong"))).status).toBe(401);expect(mocks.sync).not.toHaveBeenCalled();
});
