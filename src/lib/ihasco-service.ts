import {createHash,randomUUID} from "node:crypto";
import {Prisma,type TrainingIntegration} from "@prisma/client";
import {prisma} from "./prisma";
import {audit} from "./audit";
import {RequestError} from "./request-error";
import {IhascoClient,IhascoError,ihUser,ihCourse,ihResult,safeIhascoError,type IhResult,type IhCode} from "./ihasco-client";
import {matchIhascoEmail,onlineCourseAllowed,qualifiesIhasco,providerDate,renewalDates,syncRange,checkpointMayAdvance} from "./ihasco-rules";
import {downloadCertificate} from "./ihasco-certificates";
import {writeStaffPrivateFile,removeStaffPrivateFile,staffDocumentExpiry} from "./staff-private-storage";

const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const keyOf=(integrationId:string,externalId:string)=>({integrationId_externalId:{integrationId,externalId}});
const withoutLink=(result:IhResult)=>{const {certificate_link,...safe}=result;void certificate_link;return safe;};
type Preview={codes:IhCode[];results:IhResult[];revision:number;startedAt:string};
type Counts={imported:number;updated:number;unmatched:number;failed:number;certificates:number;certificateFailed:number;processed:number};
const emptyCounts=():Counts=>({imported:0,updated:0,unmatched:0,failed:0,certificates:0,certificateFailed:0,processed:0});
export function ihConfigurationReady(){return !!(process.env.IHASCO_ACCOUNT_KEY&&process.env.IHASCO_ORGANISATION_ID);}
async function staffScope(organisationId:string) { return {userId:{in:(await prisma.user.findMany({where:{organisationId},select:{id:true}})).map(user=>user.id)}}; }
export async function ihIntegration(organisationId:string) {
  const accountKey=process.env.IHASCO_ACCOUNT_KEY||"",org=process.env.IHASCO_ORGANISATION_ID||"";
  if(!accountKey||!org)throw new RequestError("Configure IHASCO_ACCOUNT_KEY and IHASCO_ORGANISATION_ID on the server.",503);
  if(org!==organisationId)throw new RequestError("This iHasco integration belongs to a different organisation.",403);
  const row=await prisma.trainingIntegration.upsert({where:{accountKey},create:{accountKey,organisationId},update:{}});
  if(row.organisationId!==organisationId)throw new RequestError("The configured account is already bound to another organisation.",409);
  return row;
}
type Lease={token:string;heartbeat:()=>Promise<void>;fence:(tx:Prisma.TransactionClient)=>Promise<void>;client:IhascoClient};
export async function withIhascoLock<T>(integration:TrainingIntegration,work:(lease:Lease)=>Promise<T>) {
  const token=randomUUID(),expires=()=>new Date(Date.now()+5*60_000);
  const acquired=await prisma.trainingIntegration.updateMany({where:{id:integration.id,OR:[{lockToken:null},{lockExpiresAt:{lt:new Date()}}]},data:{lockToken:token,lockExpiresAt:expires()}});
  if(!acquired.count)throw new RequestError("An iHasco operation is already running. Refresh its status shortly.",409);
  const fence=async(tx:Prisma.TransactionClient)=>{const renewed=await tx.trainingIntegration.updateMany({where:{id:integration.id,lockToken:token,lockExpiresAt:{gt:new Date()}},data:{lockExpiresAt:expires()}});if(!renewed.count)throw new IhascoError("LOCK","The sync lease expired. Retry; no checkpoint was advanced.");};
  const heartbeat=()=>fence(prisma);
  try{return await work({token,heartbeat,fence,client:new IhascoClient(undefined,undefined,undefined,heartbeat)});}
  finally{await prisma.trainingIntegration.updateMany({where:{id:integration.id,lockToken:token},data:{lockToken:null,lockExpiresAt:null}});}
}
export async function integrationAudit(id:string,action:string,userId?:string,details:object={}) {
  await audit(action,{actorType:userId?"USER":"SYSTEM",actorId:userId,entityType:"TrainingIntegration",entityId:id,afterValue:details});
}
export async function ihTest(integration:TrainingIntegration,userId:string) {
  return withIhascoLock(integration,async({client})=>{
    try{const codes=await client.codes();await prisma.trainingIntegration.update({where:{id:integration.id},data:{connectionStatus:"CONNECTED",lastError:null}});await integrationAudit(integration.id,"IHASCO_CONNECTION_TESTED",userId,{ok:true});return {ok:true,codes};}
    catch(error){const message=safeIhascoError(error);await prisma.trainingIntegration.update({where:{id:integration.id},data:{connectionStatus:"FAILED",lastError:message}});await integrationAudit(integration.id,"IHASCO_CONNECTION_TESTED",userId,{ok:false});throw new RequestError(message,502);}
  });
}
async function refreshDirectory(integration:TrainingIntegration,client:IhascoClient,heartbeat:()=>Promise<void>,results:IhResult[]=[]) {
 const users=await client.list("/users",ihUser),courses=await client.list("/courses",ihCourse);
 // Licensed-course and user listings may omit historical entities. Resolve their
 // documented individual endpoints, retaining unresolved IDs for manager review.
 for(const id of new Set(results.map(r=>r.user_id).filter(id=>!users.some(u=>u.id===id)))) {
   try {const parsed=ihUser.safeParse((await client.request(`/users/${encodeURIComponent(id)}`)).data);if(!parsed.success||parsed.data.id!==id)throw new IhascoError("FORMAT","A historic user response differs from the documented identity/fields.");users.push(parsed.data);}
   catch(error){if(!(error instanceof IhascoError&&error.code==="HTTP"&&error.message.includes("HTTP 404")))throw error;users.push({id,email:null,first_name:"Historic iHasco user",last_name:id});}
 }
 for(const id of new Set(results.map(r=>r.course_id).filter(id=>!courses.some(c=>c.course_id===id)))) {
   try {const parsed=ihCourse.safeParse((await client.request(`/courses/${encodeURIComponent(id)}`)).data);if(!parsed.success||parsed.data.course_id!==id)throw new IhascoError("FORMAT","A historic course response differs from the documented identity/fields.");courses.push(parsed.data);}
   catch(error){if(!(error instanceof IhascoError&&error.code==="HTTP"&&error.message.includes("HTTP 404")))throw error;courses.push({course_id:id,title:`Historic iHasco course ${id} (title unavailable)`});}
 }
      const staff=await prisma.staffMember.findMany({where:{...await staffScope(integration.organisationId)},select:{id:true,email:true}});
      for(const user of users){await heartbeat();const old=await prisma.trainingIntegrationUser.findUnique({where:keyOf(integration.id,user.id)});const match=matchIhascoEmail(user,users,staff);
        const occupied=match.staffId?await prisma.trainingIntegrationUser.findUnique({where:{integrationId_staffId:{integrationId:integration.id,staffId:match.staffId}}}):null;
        const candidate=occupied&&occupied.externalId!==user.id?{staffId:null,state:"AMBIGUOUS_EMAIL"}:match;
        await prisma.trainingIntegrationUser.upsert({where:keyOf(integration.id,user.id),create:{integrationId:integration.id,externalId:user.id,email:user.email||"",name:`${user.first_name} ${user.last_name}`.trim().slice(0,191),staffId:candidate.staffId,matchState:candidate.state},update:{email:user.email||"",name:`${user.first_name} ${user.last_name}`.trim().slice(0,191),...(!old?.staffId&&old?.matchState!=="MANUAL_UNMATCHED"?{staffId:candidate.staffId,matchState:candidate.state}:old?.staffId&&old.matchState!=="MANAGER_CONFIRMED"&&((old.email||"")!==(user.email||"")||candidate.state!=="EXACT_EMAIL")?{matchState:"PERSISTED_ID_EMAIL_REVIEW"}:{})}});
      }
      for(const course of courses){await heartbeat();await prisma.trainingIntegrationCourse.upsert({where:keyOf(integration.id,course.course_id),create:{integrationId:integration.id,externalId:course.course_id,title:course.title},update:{title:course.title}});}

 return {users,courses};
}
export async function ihPreview(integration:TrainingIntegration,userId:string) {
  return withIhascoLock(integration,async({client,heartbeat})=>{
    const startedAt=new Date();
    try {
      const results=(await client.list("/results?include_archived=1&fields=certificate_link",ihResult)).map(withoutLink);
      const {users,courses}=await refreshDirectory(integration,client,heartbeat,results);const codes=await client.codes();
      const token=randomUUID();await prisma.trainingIntegration.update({where:{id:integration.id},data:{connectionStatus:"CONNECTED",lastError:null,preview:json({codes,results,revision:integration.revision,startedAt:startedAt.toISOString()}),previewToken:token,previewAt:new Date()}});
      await integrationAudit(integration.id,"IHASCO_PREVIEW_CREATED",userId,{users:users.length,courses:courses.length,results:results.length});
      return {ok:true};
    }catch(error){const message=safeIhascoError(error);await prisma.trainingIntegration.update({where:{id:integration.id},data:{lastError:message}});throw new RequestError(message,502);}
  });
}
export async function ihMap(integration:TrainingIntegration,input:{kind:"staff"|"course"|"statuses";externalId?:string;targetId?:string|null;codes?:number[]},userId:string) {
  return withIhascoLock(integration,async({client})=>{
    if(input.kind==="staff"){
      if(!input.externalId||!await prisma.trainingIntegrationUser.findUnique({where:keyOf(integration.id,input.externalId)}))throw new RequestError("Refresh the preview before mapping this user.",422);
      if(input.targetId&&!await prisma.staffMember.findFirst({where:{id:input.targetId,...await staffScope(integration.organisationId)}}))throw new RequestError("Select a staff member in this organisation.",422);
      if((await prisma.trainingIntegrationUser.findUnique({where:keyOf(integration.id,input.externalId)}))?.staffId !== (input.targetId||null) && await prisma.trainingExternalResult.count({where:{integrationId:integration.id,externalUserId:input.externalId,trainingRecordId:{not:null}}}))throw new RequestError("This user already has imported evidence. Existing ownership cannot be reassigned; contact an administrator to review it.",409);
      const occupied=input.targetId?await prisma.trainingIntegrationUser.findUnique({where:{integrationId_staffId:{integrationId:integration.id,staffId:input.targetId}}}):null;
      if(occupied&&occupied.externalId!==input.externalId)throw new RequestError("Another iHasco user is already linked to this staff member. Resolve the duplicate first.",409);
      await prisma.trainingIntegrationUser.update({where:keyOf(integration.id,input.externalId),data:{staffId:input.targetId||null,matchState:input.targetId?"MANAGER_CONFIRMED":"MANUAL_UNMATCHED"}});
    }else if(input.kind==="course"){
      if(!input.externalId||!await prisma.trainingIntegrationCourse.findUnique({where:keyOf(integration.id,input.externalId)}))throw new RequestError("Refresh the preview before mapping this course.",422);
      const course=input.targetId?await prisma.trainingCourse.findUnique({where:{id:input.targetId}}):null;
      if(input.targetId&&(!course||!onlineCourseAllowed(course)))throw new RequestError("Select an active theory/course requirement. Practical, local, external and full-package sign-offs cannot be completed by iHasco.",422);
      if((await prisma.trainingIntegrationCourse.findUnique({where:keyOf(integration.id,input.externalId)}))?.courseId !== (input.targetId||null) && await prisma.trainingExternalResult.count({where:{integrationId:integration.id,externalCourseId:input.externalId,trainingRecordId:{not:null}}}))throw new RequestError("This course already has imported evidence. Its mapping cannot be changed automatically.",409);
      await prisma.trainingIntegrationCourse.update({where:keyOf(integration.id,input.externalId),data:{courseId:input.targetId||null,confirmedAt:input.targetId?new Date():null,confirmedById:userId}});
    }else{
      const codes=await client.codes(),selected=codes.filter(c=>input.codes?.includes(c.code));
      const preview=integration.preview as Preview|null;
      if(selected.some(code=>!preview?.codes.some(old=>old.code===code.code&&old.description===code.description)))throw new RequestError("Status meanings changed or have not been previewed. Refresh the preview before confirming successful statuses.",409);
      if(selected.length!==new Set(input.codes).size)throw new RequestError("Select only status codes returned by the account's /meta/codes response.",422);
      await prisma.trainingIntegration.update({where:{id:integration.id},data:{successCodes:json(selected)}});
    }
    await prisma.trainingIntegration.update({where:{id:integration.id},data:{revision:{increment:1},previewToken:null,checkpoint:null,lastFullSyncAt:null}});
    await integrationAudit(integration.id,"IHASCO_MAPPING_CONFIRMED",userId,{kind:input.kind,externalId:input.externalId,targetId:input.targetId,codes:input.codes});
  });
}
export async function ihStatus(integration:TrainingIntegration) {
  const [users,mappings,staff,courses,runs,audits,issues]=await Promise.all([
    prisma.trainingIntegrationUser.findMany({where:{integrationId:integration.id},orderBy:{name:"asc"}}),
    prisma.trainingIntegrationCourse.findMany({where:{integrationId:integration.id},orderBy:{title:"asc"}}),
    prisma.staffMember.findMany({where:{...await staffScope(integration.organisationId)},select:{id:true,displayName:true,email:true,active:true},orderBy:{displayName:"asc"}}),
    prisma.trainingCourse.findMany({where:{active:true},select:{id:true,name:true,evidenceKind:true,active:true},orderBy:{name:"asc"}}),
    prisma.scheduledJobRun.findMany({where:{jobType:"IHASCO",executionKey:{startsWith:`ihasco:${integration.id}:`}},orderBy:{startedAt:"desc"},take:20}),
    prisma.auditLog.findMany({where:{entityType:"TrainingIntegration",entityId:integration.id},select:{id:true,action:true,createdAt:true},orderBy:{createdAt:"desc"},take:30}),
    prisma.trainingExternalResult.findMany({where:{integrationId:integration.id,OR:[{staffId:null},{courseId:null},{certificateState:"RETRY"},{statusLabel:"Unknown status"}]},select:{id:true,externalId:true,courseTitle:true,statusLabel:true,certificateError:true,staffId:true,courseId:true},take:200}),
  ]);
  const preview=integration.preview as Preview|null;const approved=(integration.successCodes||[]) as IhCode[];
  const eligibleCourses=courses.filter(onlineCourseAllowed);
  const rows=preview?.results.map(r=>{const user=users.find(u=>u.externalId===r.user_id),mapping=mappings.find(c=>c.externalId===r.course_id);const course=eligibleCourses.find(c=>c.id===mapping?.courseId);return {id:r.id,userId:r.user_id,courseId:r.course_id,staffId:user?.staffId||null,courseTitle:mapping?.title||`Unlisted course ${r.course_id}`,completedAt:r.completed_at,status:preview.codes.find(c=>c.code===r.status_code)?.description||"Unknown status — review required",score:r.test_score,matched:!!(user?.staffId&&course&&mapping?.confirmedAt),qualifies:qualifiesIhasco(r,preview.codes,approved)};})||[];
  return {configured:true,keyConfigured:!!process.env.IHASCO_API_KEY,connectionStatus:integration.connectionStatus,lastError:integration.lastError,activatedAt:integration.activatedAt,lastSuccessAt:integration.lastSuccessAt,lastCounts:integration.lastCounts,running:!!integration.lockToken&&!!integration.lockExpiresAt&&integration.lockExpiresAt>new Date(),users,mappings:mappings.map(m=>({...m,suggestions:eligibleCourses.filter(c=>c.name.toLowerCase().includes(m.title.toLowerCase())||m.title.toLowerCase().includes(c.name.toLowerCase())).map(c=>c.id)})),staff,courses:eligibleCourses,codes:preview?.codes||[],approvedCodes:approved,preview:preview?{token:integration.previewToken,at:integration.previewAt,total:rows.length,matched:rows.filter(r=>r.matched).length,unmatched:rows.filter(r=>!r.matched).length,qualifying:rows.filter(r=>r.matched&&r.qualifies).length,rows:rows.slice(0,200)}:null,runs:runs.map(r=>({id:r.id,status:r.status,startedAt:r.startedAt,finishedAt:r.finishedAt,summary:r.safeSummary})),audits,issues};
}

async function importResult(integration:TrainingIntegration,result:IhResult,codes:IhCode[],actorId:string,lease:Lease,counts:Counts) {
  const [user,mapping]=await Promise.all([prisma.trainingIntegrationUser.findUnique({where:keyOf(integration.id,result.user_id)}),prisma.trainingIntegrationCourse.findUnique({where:keyOf(integration.id,result.course_id)})]);
  const [staff,course]=await Promise.all([user?.staffId?prisma.staffMember.findFirst({where:{id:user.staffId,...await staffScope(integration.organisationId)},select:{id:true}}):null,mapping?.courseId?prisma.trainingCourse.findUnique({where:{id:mapping.courseId}}):null]);
  const matched=!!(staff&&course&&mapping?.confirmedAt&&onlineCourseAllowed(course));
  const codesKnown=codes.some(c=>c.code===result.status_code);
  if(!matched)counts.unmatched++;
  if(!codesKnown)counts.failed++;
  const qualifies=matched&&qualifiesIhasco(result,codes,(integration.successCodes||[]) as IhCode[]);
  const completed=providerDate(result.completed_at),expiry=providerDate(result.expires_at),renewal=renewalDates(completed,expiry,course?.renewalMonths||null);
  const hash=createHash("sha256").update(JSON.stringify({result:withoutLink(result),staff:staff?.id,course:course?.id,qualifies,renewal:renewal.applicable})).digest("hex");
  await prisma.$transaction(async tx=>{
    await lease.fence(tx);
    const existing=await tx.trainingExternalResult.findUnique({where:keyOf(integration.id,result.id)});
    if(existing?.trainingRecordId&&((staff&&existing.staffId!==staff.id)||(course&&existing.courseId!==course.id)))throw new IhascoError("OWNERSHIP","A result's user/course changed after import. Review its ownership; existing evidence was retained.");
    let trainingRecordId=existing?.trainingRecordId||null;
    if(qualifies&&completed&&course&&staff){
      if(trainingRecordId){await tx.staffTrainingRecord.update({where:{id:trainingRecordId},data:{completedDate:completed,expiryDate:renewal.applicable,updatedById:actorId}});}
      else {const record=await tx.staffTrainingRecord.create({data:{staffId:staff.id,courseId:course.id,courseName:mapping!.title,provider:"iHasco",completedDate:completed,expiryDate:renewal.applicable,createdById:actorId,updatedById:actorId,notes:"Imported from iHasco. Online completion only; no practical or supervised sign-off."}});trainingRecordId=record.id;}
    }
    const data={externalUserId:result.user_id,externalCourseId:result.course_id,staffId:existing?.trainingRecordId?existing.staffId:staff?.id||null,courseId:existing?.trainingRecordId?existing.courseId:course?.id||null,courseTitle:mapping?.title||`iHasco course ${result.course_id}`,completedAt:completed,providerExpiryDate:expiry,starsExpiryDate:renewal.stars,score:result.test_score,passMark:result.pass_mark,attempts:result.test_attempts,statusCode:result.status_code,statusLabel:codes.find(c=>c.code===result.status_code)?.description||"Unknown status",qualifies,archivedAt:providerDate(result.archived_at),providerUpdatedAt:providerDate(result.updated_at),trainingRecordId,contentHash:hash,lastSeenAt:new Date()};
    await tx.trainingExternalResult.upsert({where:keyOf(integration.id,result.id),create:{...data,integrationId:integration.id,externalId:result.id},update:data});
    if(!existing)counts.imported++;else if(existing.contentHash!==hash)counts.updated++;
  });counts.processed++;
}

async function retryCertificates(integration:TrainingIntegration,lease:Lease,counts:Counts) {
  const pending=await prisma.trainingExternalResult.findMany({where:{integrationId:integration.id,trainingRecordId:{not:null},qualifies:true,certificateState:{not:"STORED"}},take:500,orderBy:{certificateAttemptedAt:"asc"}});
  for(const item of pending){await lease.heartbeat();let storedPath:string|undefined;
    try{
      const fresh=await lease.client.result(item.externalId);
      if(fresh.id!==item.externalId||fresh.user_id!==item.externalUserId||fresh.course_id!==item.externalCourseId)throw new IhascoError("CERT_ID","Certificate result identity changed. Review this result before downloading its evidence.");
      if(fresh.status_code!==item.statusCode||providerDate(fresh.completed_at)?.getTime()!==item.completedAt?.getTime())throw new IhascoError("CERT_CHANGED","The result changed at iHasco. Run a results sync before retrying this certificate.");
      if(!fresh.certificate_link?.url)throw new IhascoError("CERT_MISSING","No certificate link was returned with fields=certificate_link. Check certificate availability in iHasco, then retry.");
      const bytes=await downloadCertificate(fresh.certificate_link.url);storedPath=await writeStaffPrivateFile(bytes);
      await prisma.$transaction(async tx=>{await lease.fence(tx);const current=await tx.trainingExternalResult.findUniqueOrThrow({where:{id:item.id}});if(current.certificateState==="STORED")throw new IhascoError("CERT_RACE","The certificate was already stored by another operation.");const document=await tx.staffPrivateDocument.create({data:{staffId:item.staffId!,trainingRecordId:item.trainingRecordId!,storagePath:storedPath!,filename:`iHasco-${item.externalId}.pdf`,mimeType:"application/pdf",expiresAt:staffDocumentExpiry()}});await tx.trainingExternalResult.update({where:{id:item.id},data:{certificateDocumentId:document.id,certificateState:"STORED",certificateError:null,certificateAttemptedAt:new Date()}});});storedPath=undefined;counts.certificates++;
    }catch(error){if(storedPath)await removeStaffPrivateFile(storedPath);counts.certificateFailed++;await prisma.$transaction(async tx=>{await lease.fence(tx);await tx.trainingExternalResult.update({where:{id:item.id},data:{certificateState:"RETRY",certificateError:safeIhascoError(error),certificateAttemptedAt:new Date()}});});}
  }
}
export async function ihSync(integration:TrainingIntegration,input:{actorId:string;previewToken?:string;certificatesOnly?:boolean;scheduled?:boolean}) {
  return withIhascoLock(integration,async lease=>{
    const current=await prisma.trainingIntegration.findUniqueOrThrow({where:{id:integration.id}});
    if(!current.activatedAt){const preview=current.preview as Preview|null;if(!input.previewToken||input.previewToken!==current.previewToken||!preview||preview.revision!==current.revision||!current.previewAt||Date.now()-+current.previewAt>24*3600_000)throw new RequestError("Generate and review a fresh preview after confirming mappings before the first import.",409);if(!(current.successCodes as unknown[]|null)?.length)throw new RequestError("Confirm which documented statuses represent successful completion before importing.",422);}
    const startedAt=new Date(),range=syncRange(current.checkpoint,current.lastFullSyncAt,startedAt),counts=emptyCounts();
    const job=await prisma.scheduledJobRun.create({data:{executionKey:`ihasco:${current.id}:${randomUUID()}`,jobType:"IHASCO",reportDate:startedAt,status:"RUNNING",lockExpiresAt:new Date(Date.now()+5*60_000)}});
    let errorSummary:string|null=null;
    try{
      if(!input.certificatesOnly){
        const codes=await lease.client.codes();
        // Preview is deliberately refreshed on import; no expired links or stale result statuses are trusted.
        const results=await lease.client.list(range.path,ihResult);
        if(current.activatedAt)await refreshDirectory(current,lease.client,lease.heartbeat,results);
        const approved=(current.successCodes||[]) as IhCode[];
        if(approved.some(a=>!codes.some(c=>c.code===a.code&&c.description===a.description)))throw new IhascoError("STATUS_CHANGED","The meaning of an approved status code changed. Review /meta/codes and confirm successful statuses again.");
        for(const result of results){try{await lease.heartbeat();await importResult(current,result,codes,input.actorId,lease,counts);}catch(error){counts.failed++;errorSummary=`Result ${result.id}: ${safeIhascoError(error)}`;}}
      }
      await retryCertificates(current,lease,counts);
      const success=checkpointMayAdvance(counts);
      await prisma.$transaction(async tx=>{await lease.fence(tx);await tx.trainingIntegration.update({where:{id:current.id},data:{activatedAt:current.activatedAt||new Date(),approvedById:current.approvedById||input.actorId,lastCounts:json(counts),lastError:errorSummary||(!success?"Some results are unmatched or failed. Review mappings and retry; the checkpoint was retained.":counts.certificateFailed?"Results were saved; some certificates need a separate retry.":null),...(!input.certificatesOnly&&success?{checkpoint:startedAt,lastSuccessAt:new Date(),...(range.full?{lastFullSyncAt:startedAt}:{})}:{})}});});
      await prisma.scheduledJobRun.update({where:{id:job.id},data:{status:success?(counts.certificateFailed?"PARTIAL":"SUCCESS"):"PARTIAL",finishedAt:new Date(),safeSummary:JSON.stringify(counts)}});
      await integrationAudit(current.id,"IHASCO_SYNC_FINISHED",input.scheduled?undefined:input.actorId,{...counts,full:range.full,certificatesOnly:!!input.certificatesOnly});return {ok:success,counts};
    }catch(error){const message=safeIhascoError(error);await prisma.trainingIntegration.updateMany({where:{id:current.id,lockToken:lease.token},data:{lastCounts:json(counts),lastError:message}});await prisma.scheduledJobRun.update({where:{id:job.id},data:{status:"FAILED",finishedAt:new Date(),safeSummary:message}});await integrationAudit(current.id,"IHASCO_SYNC_FAILED",input.scheduled?undefined:input.actorId,{...counts});throw new RequestError(message,502);}
  });
}

export async function scheduledIhascoSync() {
  try {
  if(!ihConfigurationReady()||!process.env.IHASCO_API_KEY)return {status:"NOT_CONFIGURED"};
  const integration=await ihIntegration(process.env.IHASCO_ORGANISATION_ID!);
  if(!integration.activatedAt||!integration.approvedById)return {status:"AWAITING_MANAGER_PREVIEW"};
  if(integration.lastSuccessAt&&Date.now()-+integration.lastSuccessAt<20*3600_000)return {status:"ALREADY_SYNCED"};
  return await ihSync(integration,{actorId:integration.approvedById,scheduled:true});}catch(error){return {status:"FAILED",error:error instanceof RequestError?error.message:safeIhascoError(error)};}
}
