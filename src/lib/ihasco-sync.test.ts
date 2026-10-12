import {beforeEach,it,expect,vi} from "vitest";
import type {TrainingIntegration} from "@prisma/client";
import type {IhResult} from "./ihasco-client";
const state=vi.hoisted(()=>({db:{} as Record<string,unknown>,list:vi.fn(),codes:vi.fn(),result:vi.fn(),download:vi.fn(),audit:vi.fn()}));
vi.mock("./prisma",()=>({prisma:new Proxy({},{get:(_target,key)=>state.db[String(key)]})}));
vi.mock("./audit",()=>({audit:state.audit}));
vi.mock("./ihasco-client",async original=>{const actual=await original<typeof import("./ihasco-client")>();return {...actual,IhascoClient:class {list=state.list;codes=state.codes;result=state.result;}};});
vi.mock("./ihasco-certificates",()=>({downloadCertificate:state.download}));
vi.mock("./staff-private-storage",()=>({writeStaffPrivateFile:async()=>"private-file",removeStaffPrivateFile:async()=>{},staffDocumentExpiry:()=>new Date("2030-01-01Z")}));
import {ihMap,ihSync,withIhascoLock,ihConfirmCourseProposal,ihImportCatalogue} from "./ihasco-service";
import {courseMappingProposal,catalogueImportProposal} from "./ihasco-course-mapping";
import {IhascoError} from "./ihasco-client";
let integration:TrainingIntegration;
let external:Map<string,Record<string,unknown>>,records:Map<string,Record<string,unknown>>;
let results:IhResult[];
const fixture=(id:string,date="2020-01-01 10:00:00"):IhResult=>({id,user_id:"11",course_id:"22",completed_at:date,expires_at:"2027-01-01",test_score:90,pass_mark:80,test_attempts:2,status_code:987,archived_at:"2021-01-01",updated_at:"2026-10-12 10:00:00"});
beforeEach(()=>{
  vi.clearAllMocks();
  integration={certificatesEnabled:true,id:"integration",organisationId:"org",accountKey:"account",activatedAt:null,approvedById:null,checkpoint:null,lastFullSyncAt:null,lastSuccessAt:null,previewToken:"preview",previewAt:new Date(),preview:{revision:0,codes:[{code:987,description:"Passed"}],results:[]},revision:0,successCodes:[{code:987,description:"Passed"}],lockToken:null,lockExpiresAt:null} as unknown as TrainingIntegration;
  external=new Map();records=new Map([["manual",{id:"manual",notes:"Manual evidence stays untouched"}]]);results=[fixture("101")];
  const userMap={integrationId:"integration",externalId:"11",staffId:"staff",email:"person@example.test",name:"Test",matchState:"EXACT_EMAIL"};
  const courseMap={externalId:"22",title:"Fire Safety",courseId:"course",confirmedAt:new Date()};
  const course={id:"course",name:"Fire Safety",evidenceKind:"THEORY",active:true,renewalMonths:12};
  state.codes.mockResolvedValue([{code:987,description:"Passed"},{code:988,description:"Failed"}]);
  state.list.mockImplementation(async(path:string)=>path.startsWith("/results")?results:path==="/users"?[{id:"11",email:"person@example.test",first_name:"Test",last_name:"Person"}]:[{course_id:"22",title:"Fire Safety"}]);
  state.result.mockImplementation(async(id:string)=>({...results.find(r=>r.id===id),certificate_link:{url:"https://verified.example/temporary-secret"}}));
  state.download.mockResolvedValue(Buffer.from("%PDF-1.4"));
  state.db={
    trainingIntegration:{findUniqueOrThrow:vi.fn(async()=>({...integration})),update:vi.fn(async({data})=>Object.assign(integration,data)),updateMany:vi.fn(async({where,data})=>{
      if(where.OR&&integration.lockToken&&Number(integration.lockExpiresAt)>Date.now())return {count:0};
      if(where.lockToken&&where.lockToken!==integration.lockToken)return {count:0};
      Object.assign(integration,data);return {count:1};
    })},
    user:{findMany:vi.fn(async()=>[{id:"user"}])},
    staffMember:{findMany:vi.fn(async()=>[{id:"staff",email:"person@example.test"}]),findFirst:vi.fn(async()=>({id:"staff"}))},
    trainingCourse:{findUnique:vi.fn(async()=>course)},
    trainingIntegrationUser:{findUnique:vi.fn(async()=>userMap),upsert:vi.fn(async()=>userMap)},
    trainingIntegrationCourse:{findUnique:vi.fn(async()=>courseMap),upsert:vi.fn(async()=>courseMap)},
    trainingExternalResult:{
      findUnique:vi.fn(async({where})=>external.get(where.integrationId_externalId.externalId)||null),
      findUniqueOrThrow:vi.fn(async({where})=>[...external.values()].find(r=>r.id===where.id)),
      findMany:vi.fn(async()=>[...external.values()].filter(r=>r.trainingRecordId&&r.qualifies&&r.certificateState!=="STORED")),
      upsert:vi.fn(async({where,create,update})=>{const id=where.integrationId_externalId.externalId,old=external.get(id);const row=old?{...old,...update}:{id:`result-${id}`,certificateState:"PENDING",...create};external.set(id,row);return row;}),
      update:vi.fn(async({where,data})=>{const row=[...external.values()].find(r=>r.id===where.id)!;return Object.assign(row,data);}),
    },
    staffTrainingRecord:{create:vi.fn(async({data})=>{const id=`record-${records.size}`;const row={id,...data};records.set(id,row);return row;}),update:vi.fn(async({where,data})=>Object.assign(records.get(where.id)!,data))},
    staffPrivateDocument:{create:vi.fn(async()=>({id:"document"}))},
    scheduledJobRun:{create:vi.fn(async()=>({id:"job"})),update:vi.fn(async()=>({}))},
    $transaction:vi.fn(async fn=>fn(state.db)),
  };
});
it("blocks initial import without a manager's current preview and confirmed statuses",async()=>{
  await expect(ihSync(integration,{actorId:"manager"})).rejects.toMatchObject({status:409});expect(external.size).toBe(0);
  integration.successCodes=[];await expect(ihSync(integration,{actorId:"manager",previewToken:"preview"})).rejects.toMatchObject({status:422});
});
function catalogueFixture(imported=0) {
  const mappings=[{externalId:"22",title:"Fire Safety (Careskills)",courseId:null as string|null}];
  const courses=[{id:"old",name:"Old online subject",evidenceKind:"THEORY",active:true}];
  const create=vi.fn(async({data})=>({id:"new-course",...data})),archive=vi.fn(async()=>({count:1}));
  state.db.trainingCourse={findMany:vi.fn(async()=>courses),create,updateMany:archive,update:vi.fn()};
  state.db.trainingIntegrationCourse={findMany:vi.fn(async()=>mappings),count:vi.fn(async()=>0),updateMany:vi.fn(async()=>({count:1}))};
  state.db.trainingExternalResult={count:vi.fn(async()=>imported)};
  state.db.trainingProvider={upsert:vi.fn(async()=>({id:"provider"}))};
  return {mappings,courses,create,archive};
}
it("creates and links a reviewed catalogue without importing staff results",async()=>{
  const f=catalogueFixture(),proposal=catalogueImportProposal(f.mappings,f.courses,0);
  await expect(ihImportCatalogue(integration,proposal.token,"manager")).resolves.toMatchObject({created:1,matched:0,catalogueChanged:true});
  expect(f.create).toHaveBeenCalledWith({data:expect.objectContaining({name:"Fire Safety (Careskills)",evidenceKind:"THEORY",renewalMonths:null,requirementRules:expect.objectContaining({"Support Worker":"OPTIONAL"})})});
  expect(f.archive).not.toHaveBeenCalled();expect(records.size).toBe(1);expect(external.size).toBe(0);expect(integration.previewToken).toBeNull();
});
it("requires the separate reset preview and blocks resets after results import",async()=>{
  const f=catalogueFixture(),proposal=catalogueImportProposal(f.mappings,f.courses,0);
  await expect(ihImportCatalogue(integration,proposal.token,"manager",true)).rejects.toMatchObject({status:409});
  expect(f.create).not.toHaveBeenCalled();expect(f.archive).not.toHaveBeenCalled();
  catalogueFixture(1);
  await expect(ihImportCatalogue(integration,"any-token","manager",true)).rejects.toMatchObject({status:409});
});
it("resets only the reviewed online catalogue while retaining evidence",async()=>{
  const f=catalogueFixture(),proposal=catalogueImportProposal(f.mappings,f.courses,0,true);
  await expect(ihImportCatalogue(integration,proposal.token,"manager",true)).resolves.toMatchObject({created:1,archived:1});
  expect(f.archive).toHaveBeenCalledWith({where:{id:{in:["old"]}},data:{active:false,updatedById:"manager"}});
  expect(records.get("manual")).toEqual({id:"manual",notes:"Manual evidence stays untouched"});
  expect(state.audit).toHaveBeenCalledWith("IHASCO_TRAINING_CATALOGUE_RESET",expect.anything());
});
it("confirms reviewed course matches without importing results and invalidates the first-import preview",async()=>{
  const mappings=[{externalId:"22",title:"Fire Safety (Careskills)",courseId:null}],courses=[{id:"course",name:"Fire Safety (Careskills)",evidenceKind:"THEORY",active:true}];
  const updateMany=vi.fn(async()=>({count:1}));
  state.db.trainingIntegrationCourse={findMany:vi.fn(async()=>mappings),updateMany};
  state.db.trainingCourse={findMany:vi.fn(async()=>courses)};
  const proposal=courseMappingProposal(mappings,courses,0);
  await expect(ihConfirmCourseProposal(integration,"stale-token","manager")).rejects.toMatchObject({status:409});
  expect(updateMany).not.toHaveBeenCalled();
  await expect(ihConfirmCourseProposal(integration,proposal.token,"manager")).resolves.toMatchObject({ok:true,confirmed:1});
  expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{integrationId:"integration",externalId:"22",courseId:null},data:expect.objectContaining({courseId:"course",confirmedById:"manager"})}));
  expect(integration.previewToken).toBeNull();expect(records.size).toBe(1);expect(external.size).toBe(0);
  expect(state.audit).toHaveBeenCalledWith("IHASCO_COURSE_MATCHES_CONFIRMED",expect.anything());
});
it("imports historic/repeat completions once each without replacing manual evidence",async()=>{
  results=[fixture("101"),fixture("102","2024-01-01 10:00:00")];
  const first=await ihSync(integration,{actorId:"manager",previewToken:"preview"});expect(first.counts.imported).toBe(2);expect(records.size).toBe(3);
  expect([...external.values()].map(r=>r.completedAt)).toEqual([new Date("2020-01-01Z"),new Date("2024-01-01Z")]);
  const second=await ihSync(integration,{actorId:"manager"});expect(second.counts.imported).toBe(0);expect(records.size).toBe(3);expect(external.size).toBe(2);
  expect(records.get("manual")).toEqual({id:"manual",notes:"Manual evidence stays untouched"});
  expect(JSON.stringify([...external.values()])).not.toContain("temporary-secret");
});
it("stores failed results without giving compliance credit",async()=>{
  results=[{...fixture("101"),status_code:988,test_score:25}];await ihSync(integration,{actorId:"manager",previewToken:"preview"});
  expect(external.get("101")?.qualifies).toBe(false);expect(external.get("101")?.trainingRecordId).toBeNull();expect(records.size).toBe(1);expect(state.download).not.toHaveBeenCalled();
});
it("retains imported results and retrieves a fresh certificate link on a separate retry",async()=>{
  state.download.mockRejectedValueOnce(new IhascoError("CERT_NETWORK","Certificate link expired; retry certificates."));
  const first=await ihSync(integration,{actorId:"manager",previewToken:"preview"});expect(first.counts.imported).toBe(1);expect(first.counts.certificateFailed).toBe(1);expect(external.get("101")?.certificateState).toBe("RETRY");
  const checkpoint=integration.checkpoint;const second=await ihSync(integration,{actorId:"manager",certificatesOnly:true});
  expect(second.counts.certificates).toBe(1);expect(state.result).toHaveBeenCalledTimes(2);expect(external.get("101")?.certificateState).toBe("STORED");expect(records.size).toBe(2);expect(integration.checkpoint).toEqual(checkpoint);
});
it("does not advance checkpoints after partial result failures or lose earlier successful results",async()=>{
  results=[fixture("101"),fixture("102","2026-99-01")];const result=await ihSync(integration,{actorId:"manager",previewToken:"preview"});
  expect(result.counts.failed).toBe(1);expect(integration.checkpoint).toBeNull();expect(external.has("101")).toBe(true);expect(external.get("102")).toMatchObject({completedAt:null,completionTimestamp:"2026-99-01",qualifies:true});expect(result.counts.unresolved).toBe(1);expect(records.size).toBe(2);
});
it("does not remove local evidence when the provider omits records or fails",async()=>{
  await ihSync(integration,{actorId:"manager",previewToken:"preview"});const checkpoint=integration.checkpoint;
  state.codes.mockRejectedValueOnce(new IhascoError("NETWORK","Provider unavailable"));await expect(ihSync(integration,{actorId:"manager"})).rejects.toMatchObject({status:502});expect(integration.checkpoint).toEqual(checkpoint);expect(records.size).toBe(2);
  results=[];await ihSync(integration,{actorId:"manager"});expect(records.size).toBe(2);expect(external.size).toBe(1);
});
it("prevents concurrent manual/scheduled operations",async()=>{
  integration.lockToken="other";integration.lockExpiresAt=new Date(Date.now()+60000);
  const callback=vi.fn();await expect(withIhascoLock(integration,callback)).rejects.toMatchObject({status:409});expect(callback).not.toHaveBeenCalled();
});

it("imports results without requesting or downloading certificates when disabled",async()=>{integration.certificatesEnabled=false;await ihSync(integration,{actorId:"manager",previewToken:"preview"});expect(external.size).toBe(1);expect(records.size).toBe(2);expect(state.result).not.toHaveBeenCalled();expect(state.download).not.toHaveBeenCalled();expect(state.list.mock.calls.filter(c=>String(c[0]).startsWith("/results")).every(c=>!String(c[0]).includes("certificate_link"))).toBe(true);});
it("blocks normal sync while a reset awaits reconciliation",async()=>{integration.syncPaused=true;await expect(ihSync(integration,{actorId:"manager",previewToken:"preview"})).rejects.toMatchObject({status:409});expect(state.list).not.toHaveBeenCalled();});

it("blocks an activated sync with empty approved statuses without changing evidence or checkpoints",async()=>{
  await ihSync(integration,{actorId:"manager",previewToken:"preview"});
  const checkpoint=integration.checkpoint, evidence=JSON.stringify([...external.values()]);
  integration.successCodes=[];state.list.mockClear();
  await expect(ihSync(integration,{actorId:"manager"})).rejects.toMatchObject({status:422});
  expect(state.list).not.toHaveBeenCalled();expect(integration.checkpoint).toEqual(checkpoint);
  expect(JSON.stringify([...external.values()])).toBe(evidence);
});
it("rejects empty and unsuccessful status selections before saving",async()=>{
  await expect(ihMap(integration,{kind:"statuses",codes:[]},"manager")).rejects.toMatchObject({status:422});
  await expect(ihMap(integration,{kind:"statuses",codes:[988]},"manager")).rejects.toMatchObject({status:422});
  expect(integration.successCodes).toEqual([{code:987,description:"Passed"}]);
});
it("restores credit on existing results after status confirmation without duplicating evidence",async()=>{
  await ihSync(integration,{actorId:"manager",previewToken:"preview"});
  external.get("101")!.qualifies=false;
  await ihMap(integration,{kind:"statuses",codes:[987]},"manager");
  await ihSync(integration,{actorId:"manager"});
  expect(external.get("101")?.qualifies).toBe(true);expect(records.size).toBe(2);expect(external.size).toBe(1);
});
