import {Prisma} from "@prisma/client";
import {prisma} from "./prisma";
import {MyDayError,requireMydayClient,type MyDayActor} from "./myday-auth";
import {myDayDate,mydayCanonicalJson,submissionSchema,type MyDaySubmission} from "./myday-rules";
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function mydayTransaction<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
 for(let attempt=0;;attempt++){try{return await prisma.$transaction(fn,{isolationLevel:"Serializable"});}catch(e){const code=e&&typeof e==="object"&&"code" in e?String(e.code):"";if(attempt>=3||!["P2034","P2002"].includes(code))throw e;await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)));}}
}
export async function saveMydayEntry(actor:MyDayActor,input:MyDaySubmission,reviewAccepted=false){
 const v=submissionSchema.parse(input);
 if(new Date(v.occurredAt).getTime()>Date.now()+5*60_000)throw new MyDayError("The entry time is in the future. Check the tablet clock.",422);
 await requireMydayClient(v.studentId,reviewAccepted);
 return mydayTransaction(async tx=>{
  const replay=await tx.myDayRevision.findUnique({where:{requestKey:v.requestKey}});
  if(replay){if(replay.actorId!==actor.id||replay.entryId!==v.id||mydayCanonicalJson(replay.content)!==mydayCanonicalJson(v))throw new MyDayError("This request was already used with different details.",409);return {saved:true,id:v.id};}
  const current=await tx.myDayEntry.findUnique({where:{id:v.id}});
  if(current){
   if(current.organisationId!==actor.organisationId||current.studentId!==v.studentId)throw new MyDayError("Entry unavailable.",404);
   if(current.authorId!==actor.id&&!actor.admin)throw new MyDayError("Add a follow-up under your own name instead.",403);
   if(current.occurredAt.toISOString()!==v.occurredAt)throw new MyDayError("An edit must preserve the original event time.",422);
   if(current.version!==v.baseVersion){await tx.myDayReview.upsert({where:{id:v.requestKey},update:{},create:{id:v.requestKey,organisationId:actor.organisationId,staffId:actor.id,reason:"EDIT_CONFLICT",payload:json({submission:v,actor})}});return {review:true,id:v.id};}
   const updated=await tx.myDayEntry.updateMany({where:{id:v.id,version:v.baseVersion},data:{content:json(v.content),handover:v.content.handover,version:{increment:1},editedBy:actor.name}});if(!updated.count)throw new MyDayError("Another worker changed this entry. Reload before saving.",409);
  }else{
   if(v.baseVersion)throw new MyDayError("The original entry is unavailable.",404);
   await tx.myDayEntry.create({data:{id:v.id,studentId:v.studentId,organisationId:actor.organisationId,authorId:actor.id,authorName:actor.name,occurredAt:new Date(v.occurredAt),day:myDayDate(v.occurredAt),content:json(v.content),handover:v.content.handover}});
  }
  await tx.myDayRevision.create({data:{entryId:v.id,requestKey:v.requestKey,version:current?current.version+1:1,content:json(v),actorId:actor.id,actorName:actor.name}});
  await tx.auditLog.create({data:{action:current?"MYDAY_ENTRY_EDITED":"MYDAY_ENTRY_CREATED",actorType:"USER",actorId:actor.id,entityType:"MyDayEntry",entityId:v.id,afterValue:{version:current?current.version+1:1,reviewAccepted}}});
  return {saved:true,id:v.id};
 });
}
