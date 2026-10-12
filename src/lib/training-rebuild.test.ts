import {beforeEach,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({db:{} as Record<string,unknown>,files:new Map<string,string>(),write:vi.fn(),events:[] as string[],integration:{id:"integration",rebuildVersion:null as string|null},courses:[] as Record<string,unknown>[]}));
vi.mock("node:fs/promises",()=>({mkdir:vi.fn(),writeFile:state.write,readFile:async(file:string)=>state.files.get(file)}));
vi.mock("./prisma",()=>({prisma:new Proxy({},{get:(_t,key)=>state.db[String(key)]})}));
vi.mock("./permissions",()=>({CAPABILITIES:{TRAINING_MANAGE:"training"},hasCapability:()=>true}));
vi.mock("./ihasco-service",()=>({ihIntegration:async()=>state.integration,withIhascoLock:async(_i:unknown,work:(lease:unknown)=>Promise<unknown>)=>work({fence:async()=>{}}),ihPreview:vi.fn(),ihConfirmCourseProposal:vi.fn(),ihSync:vi.fn()}));
import {rebuildTraining} from "./training-rebuild";
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv("IHASCO_API_KEY","");state.events=[];state.files.clear();state.courses=[];state.integration={id:"integration",rebuildVersion:null};
 state.write.mockImplementation(async(file:string,data:string)=>{state.events.push("backup");state.files.set(file,data);});
 const empty=()=>({findMany:vi.fn(async()=>[]),updateMany:vi.fn(async()=>({count:0})),deleteMany:vi.fn(async()=>({count:0}))});
 state.db={user:{findFirst:vi.fn(async()=>({id:"manager"}))},organisation:{count:vi.fn(async()=>1)},trainingIntegration:{findUniqueOrThrow:vi.fn(async()=>state.integration),update:vi.fn(async({data})=>Object.assign(state.integration,data))},trainingCourse:{findMany:vi.fn(async()=>state.courses),updateMany:vi.fn(async()=>{state.events.push("reset");return {count:0};}),upsert:vi.fn(async({create})=>{const row={id:create.name,...create};state.courses.push(row);return row;})},trainingProvider:{findMany:vi.fn(async()=>[]),upsert:vi.fn(async()=>({id:"provider"}))},trainingCourseProvider:{...empty(),create:vi.fn()},staffTrainingRecord:empty(),staffTrainingAssignment:empty(),trainingIntegrationUser:empty(),trainingIntegrationCourse:empty(),trainingExternalResult:empty(),staffPrivateDocument:{findMany:vi.fn(async()=>[{id:"certificate",storagePath:"private/existing.pdf"}])},auditLog:{create:vi.fn()},$transaction:async(work:(tx:unknown)=>Promise<unknown>)=>work(state.db)};
});
it("backs up before training-only reset and builds all 60 courses even without API credentials",async()=>{
 const report=await rebuildTraining("manager","org");
 expect(state.events).toEqual(["backup","reset"]);expect(state.courses).toHaveLength(60);expect(report.blocker).toContain("IHASCO_API_KEY");
 const snapshot=JSON.parse([...state.files.values()][0]);expect(snapshot.tables.StaffPrivateDocument[0].storagePath).toBe("private/existing.pdf");
 expect(state.integration).toMatchObject({syncPaused:true,certificatesEnabled:false,checkpoint:null});
 expect(Object.keys(state.db)).not.toContain("staffMember");
});
it("does not reset or duplicate the catalogue when the command is rerun",async()=>{
 await rebuildTraining("manager","org");const next=await rebuildTraining("manager","org");
 expect(next.reset.reused).toBe(true);expect(state.events).toEqual(["backup","reset"]);expect(state.courses).toHaveLength(60);
});
it("does not mutate training if the backup cannot be written",async()=>{
 state.write.mockRejectedValue(new Error("Backup unavailable"));
 await expect(rebuildTraining("manager","org")).rejects.toThrow("Backup unavailable");expect(state.events).toEqual([]);expect(state.courses).toEqual([]);
});
