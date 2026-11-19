import {v5 as uuidv5} from "uuid";
import {NextRequest} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withMyday,mydayJson,MyDayError,type MyDayActor} from "@/lib/myday-auth";
import {mydayTransaction,saveMydayEntry} from "@/lib/myday-service";
import {submissionSchema} from "@/lib/myday-rules";
export async function GET(req:NextRequest){return withMyday(req,async actor=>mydayJson({reviews:await prisma.myDayReview.findMany({where:{organisationId:actor.organisationId,status:"OPEN"},orderBy:{createdAt:"asc"},take:200}),clients:await prisma.student.findMany({where:{archivedAt:null},select:{id:true,displayName:true}})}),true);}
const action=z.discriminatedUnion("action",[
 z.object({action:z.literal("visibility"),studentId:z.string().uuid(),hidden:z.boolean()}),
 z.object({action:z.literal("activity"),id:z.string().uuid(),label:z.string().trim().min(1).max(191),position:z.number().int().min(0).max(9999),archived:z.boolean(),version:z.number().int().optional()}),
 z.object({action:z.literal("review"),id:z.string().uuid(),decision:z.enum(["ACCEPT","DISCARD"])}),
]);
export async function POST(req:NextRequest){return withMyday(req,async actor=>{
 const p=action.safeParse(await req.json().catch(()=>null));if(!p.success)return mydayJson({error:"Check the management action."},422);const v=p.data;
 if(v.action==="visibility"){if(!await prisma.student.findUnique({where:{id:v.studentId}}))throw new MyDayError("Client unavailable.",404);await mydayTransaction(async tx=>{await tx.myDayClient.upsert({where:{studentId:v.studentId},update:{hidden:v.hidden},create:{studentId:v.studentId,hidden:v.hidden}});await tx.auditLog.create({data:{action:"MYDAY_VISIBILITY_CHANGED",actorType:"USER",actorId:actor.id,entityType:"Student",entityId:v.studentId,afterValue:{hidden:v.hidden}}});});}
 if(v.action==="activity"){await mydayTransaction(async tx=>{const existing=await tx.myDayActivity.findUnique({where:{id:v.id}});if(existing){if(existing.organisationId!==actor.organisationId)throw new MyDayError("Activity unavailable.",404);if(!(await tx.myDayActivity.updateMany({where:{id:v.id,version:v.version},data:{label:v.label,position:v.position,archived:v.archived,version:{increment:1}}})).count)throw new MyDayError("Activity changed. Reload before editing.",409);}else {if(v.version)throw new MyDayError("Activity unavailable.",404);await tx.myDayActivity.create({data:{id:v.id,organisationId:actor.organisationId,label:v.label,position:v.position,archived:v.archived}});}await tx.auditLog.create({data:{action:"MYDAY_ACTIVITY_UPDATED",actorType:"USER",actorId:actor.id,entityType:"MyDayActivity",entityId:v.id}});});}
 if(v.action==="review"){
  const review=await prisma.myDayReview.findFirst({where:{id:v.id,organisationId:actor.organisationId,status:"OPEN"}});if(!review)throw new MyDayError("This submission has already been reviewed.",409);
  if(v.decision==="ACCEPT"){
   const payload=review.payload as unknown as {submission:unknown;actor:MyDayActor},submission=submissionSchema.parse(payload.submission);
   const current=await prisma.myDayEntry.findUnique({where:{id:submission.id}});
   // Acceptance creates an attributed follow-up if the shared entry has moved on.
   // It never replaces a newer version that the manager has not explicitly edited.
   const accepted={...submission,id:uuidv5(review.id,uuidv5.URL),requestKey:review.id,baseVersion:undefined,content:current?{...submission.content,text:`${submission.content.text}\n[Accepted offline correction to entry ${current.id}]`.trim()}:submission.content};
   await saveMydayEntry({...payload.actor,admin:true,organisationId:actor.organisationId},accepted,true);
  }
  await mydayTransaction(async tx=>{const claim=await tx.myDayReview.updateMany({where:{id:v.id,status:"OPEN"},data:{status:v.decision==="ACCEPT"?"ACCEPTED":"DISCARDED",decidedBy:actor.id,decidedAt:new Date()}});if(!claim.count)throw new MyDayError("Already reviewed.",409);await tx.auditLog.create({data:{action:"MYDAY_SUBMISSION_REVIEWED",actorType:"USER",actorId:actor.id,entityType:"MyDayReview",entityId:v.id,afterValue:{decision:v.decision}}});});
 }
 return mydayJson({saved:true});
},true);}
