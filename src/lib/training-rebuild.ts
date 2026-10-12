import {mkdir,writeFile,readFile} from "node:fs/promises";
import path from "node:path";
import {createHash,randomUUID} from "node:crypto";
import {Prisma} from "@prisma/client";
import {prisma} from "./prisma";
import {canonicalTrainingCourses,policyVersion,verifyCanonicalCatalogue} from "./training-policy";
import {explicitNumberedLevel} from "./training-catalogue";
import {ihIntegration,ihPreview,ihConfirmCourseProposal,ihSync,withIhascoLock} from "./ihasco-service";
import {courseMappingProposal} from "./ihasco-course-mapping";
import {IhascoClient,safeIhascoError} from "./ihasco-client";
import {CAPABILITIES,hasCapability} from "./permissions";

const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function rebuildTraining(actorId:string,organisationId:string){
 const expected=verifyCanonicalCatalogue();
 const actor=await prisma.user.findFirst({where:{id:actorId,organisationId}});
 if(!actor||!hasCapability(actor.role,CAPABILITIES.TRAINING_MANAGE,actor.permissionOverrides))throw new Error("The supplied actor must be an existing training manager in the target organisation.");
 // Courses are shared in the existing schema. Never reset another organisation's catalogue.
 if(await prisma.organisation.count()>1)throw new Error("This installation has multiple organisations sharing a catalogue. A scoped migration is required; nothing was reset.");
 const integration=await ihIntegration(organisationId);
 const reset=await withIhascoLock(integration,async lease=>{
  const current=await prisma.trainingIntegration.findUniqueOrThrow({where:{id:integration.id}});
  if(current.rebuildVersion===policyVersion){await prisma.trainingIntegration.update({where:{id:integration.id},data:{syncPaused:true,certificatesEnabled:false,checkpoint:null,lastFullSyncAt:null}});return {reused:true,backup:null};}
  return prisma.$transaction(async tx=>{
   await lease.fence(tx);
   const snapshot={format:1,version:policyVersion,createdAt:new Date(),tables:{
    TrainingCourse:await tx.trainingCourse.findMany(),TrainingProvider:await tx.trainingProvider.findMany(),TrainingCourseProvider:await tx.trainingCourseProvider.findMany(),
    StaffTrainingRecord:await tx.staffTrainingRecord.findMany(),StaffTrainingAssignment:await tx.staffTrainingAssignment.findMany(),
    TrainingIntegration:[{...current,lockToken:null,lockExpiresAt:null,preview:null,previewToken:null}],
    TrainingIntegrationUser:await tx.trainingIntegrationUser.findMany({where:{integrationId:integration.id}}),
    TrainingIntegrationCourse:await tx.trainingIntegrationCourse.findMany({where:{integrationId:integration.id}}),
    TrainingExternalResult:await tx.trainingExternalResult.findMany({where:{integrationId:integration.id}}),
    StaffPrivateDocument:await tx.staffPrivateDocument.findMany({where:{trainingRecordId:{not:null}}}),
   }};
   const directory=path.resolve(process.env.TRAINING_BACKUP_DIR||path.join(process.cwd(),".data","training-backups"));
   await mkdir(directory,{recursive:true,mode:0o700});
   const backup=path.join(directory,`training-${Date.now()}-${randomUUID()}.json`),contents=JSON.stringify(snapshot,null,2);
   await writeFile(backup,contents,{flag:"wx",mode:0o600});
   if(createHash("sha256").update(await readFile(backup)).digest("hex")!==createHash("sha256").update(contents).digest("hex"))throw new Error("Backup verification failed; no training changes were committed.");
   await tx.trainingCourse.updateMany({data:{active:false,updatedById:actorId}});
   await tx.staffTrainingRecord.updateMany({where:{active:true},data:{active:false,updatedById:actorId}});
   await tx.staffTrainingAssignment.deleteMany();
   await tx.trainingIntegrationCourse.updateMany({where:{integrationId:integration.id},data:{courseId:null,confirmedAt:null,confirmedById:null}});
   // Keep verified learner IDs and all attempt/certificate history. Reconcile ownership afresh.
   await tx.trainingIntegrationUser.updateMany({where:{integrationId:integration.id,matchState:{not:"MANAGER_CONFIRMED"}},data:{staffId:null,matchState:"REQUIRES_REVIEW"}});
   await tx.trainingExternalResult.updateMany({where:{integrationId:integration.id},data:{trainingRecordId:null,courseId:null,qualifies:false}});
   for(const definition of canonicalTrainingCourses){
    const data={...definition,catalogueKey:`stars-policy-${createHash("sha256").update(definition.name).digest("hex").slice(0,40)}`,policy:json(definition.policy),description:definition.policy.instructions||"STARS local policy renewal interval; not a statement of legal certificate expiry.",active:true,numberedLevel:explicitNumberedLevel(definition.name),updatedById:actorId};
    const course=await tx.trainingCourse.upsert({where:{name:definition.name},create:{...data,createdById:actorId},update:data});
    await tx.trainingCourseProvider.deleteMany({where:{courseId:course.id}});
    if(definition.evidenceKind==="THEORY"){
     const name=definition.name.endsWith("(Careskills)")?"Careskills":definition.name.endsWith("(Flexebee)")?"Flexebee":"iHasco";
     const provider=await tx.trainingProvider.upsert({where:{name},create:{name,createdById:actorId,updatedById:actorId},update:{active:true}});
     await tx.trainingCourseProvider.create({data:{courseId:course.id,providerId:provider.id,preferred:true}});
    }
   }
   const onlineIds=snapshot.tables.TrainingCourse.filter(c=>canonicalTrainingCourses.some(d=>d.name===c.name&&d.evidenceKind==="THEORY")).map(c=>c.id);
   for(const mapping of snapshot.tables.TrainingIntegrationCourse.filter(m=>m.confirmedAt&&m.courseId&&onlineIds.includes(m.courseId))){
    await tx.trainingIntegrationCourse.update({where:{integrationId_externalId:{integrationId:integration.id,externalId:mapping.externalId}},data:{courseId:mapping.courseId,confirmedAt:mapping.confirmedAt,confirmedById:mapping.confirmedById}});
   }
   await tx.trainingIntegration.update({where:{id:integration.id},data:{rebuildVersion:policyVersion,syncPaused:true,certificatesEnabled:false,activatedAt:null,approvedById:actorId,checkpoint:null,lastFullSyncAt:null,lastSuccessAt:null,preview:Prisma.DbNull,previewToken:null,previewAt:null,revision:{increment:1},lastError:null,lastCounts:Prisma.DbNull}});
   await tx.auditLog.create({data:{action:"TRAINING_POLICY_REBUILT",actorType:"USER",actorId,entityType:"TrainingIntegration",entityId:integration.id,afterValue:json({version:policyVersion,expected,backup:path.basename(backup)})}});
   return {reused:false,backup};
  },{timeout:60000});
 });
 const actual=await prisma.trainingCourse.findMany({where:{active:true}});
 if(actual.length!==60||actual.filter(c=>c.evidenceKind==="THEORY").length!==45)throw new Error("Post-rebuild catalogue verification failed. Sync remains paused.");
 const report:{catalogue:typeof expected;reset:typeof reset;sync?:unknown;blocker?:string;unmappedCourses?:unknown;canonicalCoursesAwaitingMapping?:unknown;practicalAwaitingEvidence?:number;learners?:unknown}={catalogue:expected,reset,practicalAwaitingEvidence:15};
 try{
  if(!process.env.IHASCO_API_KEY)throw new Error("IHASCO_API_KEY is absent. The catalogue is rebuilt; configure the server key and rerun this command.");
  await ihPreview(await ihIntegration(organisationId),actorId);
  let current=await ihIntegration(organisationId);
  const mappings=await prisma.trainingIntegrationCourse.findMany({where:{integrationId:current.id}});
  const proposal=courseMappingProposal(mappings,actual,current.revision);
  if(proposal.pairs.length)await ihConfirmCourseProposal(current,proposal.token,actorId);
  // Use meanings returned by this account, never assumed numeric codes.
  const codes=await new IhascoClient().codes();
  const success=codes.filter(c=>/^(test passed|passed|completed successfully|test complete|completed|expired|expiring soon)$/i.test(c.description.trim()));
  if(!success.length)throw new Error("No unambiguous successful result statuses were returned by /meta/codes. Review status meanings in the manager integration screen.");
  await prisma.trainingIntegration.update({where:{id:current.id},data:{successCodes:json(success)}});
  await ihPreview(await ihIntegration(organisationId),actorId);
  current=await ihIntegration(organisationId);
  report.sync=await ihSync(current,{actorId,previewToken:current.previewToken||undefined,reconciliation:true});
  if((report.sync as {ok:boolean}).ok)await prisma.trainingIntegration.update({where:{id:current.id},data:{syncPaused:false}});
  else report.blocker="Reconciliation is partial. Resolve unmatched relevant learners/courses in iHasco integration and rerun this command. Scheduled sync remains paused.";
  const linked=await prisma.trainingIntegrationCourse.findMany({where:{integrationId:current.id,courseId:{not:null}},select:{courseId:true}});
  report.canonicalCoursesAwaitingMapping=actual.filter(c=>c.evidenceKind==="THEORY"&&!linked.some(m=>m.courseId===c.id)).map(c=>c.name);
  report.unmappedCourses=await prisma.trainingIntegrationCourse.findMany({where:{integrationId:current.id,courseId:null},select:{externalId:true,title:true}});
  report.learners={matched:await prisma.trainingIntegrationUser.count({where:{integrationId:current.id,staffId:{not:null}}}),unmatched:await prisma.trainingIntegrationUser.count({where:{integrationId:current.id,staffId:null}})};
 }catch(error){report.blocker=error instanceof Error&&!(error.name.includes("Prisma"))?error.message:safeIhascoError(error);}
 return report;
}
