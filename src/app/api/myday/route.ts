import {NextRequest} from "next/server";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withMyday,mydayJson,requireMydayClient,MyDayError} from "@/lib/myday-auth";
import {identityDetails,myDayDate,planSections,submissionSchema} from "@/lib/myday-rules";
import {mydayTransaction,saveMydayEntry} from "@/lib/myday-service";
export async function GET(req:NextRequest){return withMyday(req,async actor=>{
 const studentId=req.nextUrl.searchParams.get("client"),month=req.nextUrl.searchParams.get("month")||myDayDate().slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new MyDayError("Choose a valid month.",422);
 if(studentId){const client=await requireMydayClient(studentId,true);const hidden=(await prisma.myDayClient.findUnique({where:{studentId}}))?.hidden||!client.active;
  const noteId=req.nextUrl.searchParams.get("note");
  // Hidden clients may only be opened through a currently flagged register note.
  if(hidden&&!actor.admin&&!noteId)throw new MyDayError("This client is hidden from My Day.",403);
  const note=noteId?await prisma.myDayEntry.findFirst({where:{id:noteId,studentId,organisationId:actor.organisationId,day:myDayDate(),handover:true}}):null;
  if(noteId&&!note)throw new MyDayError("This handover marker is no longer current. Open the client's calendar to view older notes.",404);
  const entries=await prisma.myDayEntry.findMany({where:{studentId,organisationId:actor.organisationId,...(hidden&&!actor.admin?{day:myDayDate(),handover:true}:{day:{startsWith:month}})},orderBy:[{occurredAt:"asc"},{createdAt:"asc"}]});
  const history=hidden&&!actor.admin?[]:await prisma.myDayPlanHistory.findMany({where:{studentId,organisationId:actor.organisationId},orderBy:{createdAt:"desc"},take:200});
  return mydayJson({client:{id:client.id,name:client.displayName,photoDocumentUrl:client.profilePhotoUrl,photo:client.profilePhotoUrl?`/api/myday/photo?client=${client.id}&v=${client.updatedAt.getTime()}`:null,...identityDetails(client.medicalProfile,client.careInformation),plan:hidden&&!actor.admin?{}:client.personCentredProfile||{},hidden},entries,history});
 }
 const [clients,visibility,activities,markers]=await Promise.all([
  prisma.student.findMany({where:{active:true,archivedAt:null},orderBy:{displayName:"asc"},select:{id:true,displayName:true,firstName:true,lastName:true,medicalProfile:true,careInformation:true,profilePhotoUrl:true,updatedAt:true}}),
  prisma.myDayClient.findMany(),prisma.myDayActivity.findMany({where:{organisationId:actor.organisationId,...(actor.admin?{}:{archived:false})},orderBy:[{position:"asc"},{label:"asc"}]}),
  prisma.myDayEntry.findMany({where:{organisationId:actor.organisationId,day:myDayDate(),handover:true},select:{id:true,studentId:true}})
 ]);
 return mydayJson({actor,clients:clients.filter(c=>actor.admin||!visibility.find(v=>v.studentId===c.id)?.hidden).map(c=>({id:c.id,name:c.displayName,search:[c.displayName,c.firstName,c.lastName].join(" "),hidden:visibility.find(v=>v.studentId===c.id)?.hidden||false,photo:c.profilePhotoUrl?`/api/myday/photo?client=${c.id}&v=${c.updatedAt.getTime()}`:null,...identityDetails(c.medicalProfile,c.careInformation),handover:markers.filter(m=>m.studentId===c.id).map(m=>m.id)})),activities});
});}
export async function POST(req:NextRequest){return withMyday(req,async actor=>{const parsed=submissionSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return mydayJson({error:parsed.error.issues[0].message},422);return mydayJson(await saveMydayEntry(actor,parsed.data));});}
const planInput=z.object({studentId:z.string().uuid(),section:z.string(),before:z.string().max(12000),text:z.string().trim().max(12000),key:z.string().uuid()});
export async function PATCH(req:NextRequest){return withMyday(req,async actor=>{
 const input=planInput.safeParse(await req.json().catch(()=>null));if(!input.success)return mydayJson({error:"Check the plan section."},422);const v=input.data;
 if(!(v.section in planSections)&&v.section!=="additionalNotes")throw new MyDayError("Unknown plan section.",422);
 await requireMydayClient(v.studentId);
 await mydayTransaction(async tx=>{
  const prior=await tx.myDayPlanHistory.findUnique({where:{id:v.key}});if(prior){if(prior.actorId!==actor.id||prior.studentId!==v.studentId||prior.afterText!==v.text)throw new MyDayError("Request already used.",409);return;}
  const client=await tx.student.findUniqueOrThrow({where:{id:v.studentId}}),plan=(client.personCentredProfile||{}) as Record<string,Prisma.InputJsonValue>;
  if(v.section==="additionalNotes"){if(!v.text)throw new MyDayError("Write a note.",422);plan.mydayAdditionalNotes=[{id:v.key,text:v.text,author:actor.name,createdAt:new Date().toISOString()},...(Array.isArray(plan.mydayAdditionalNotes)?plan.mydayAdditionalNotes:[])];}
  else {if(String(plan[v.section]||"")!==v.before)throw new MyDayError("This section changed. Reload to read the latest wording before editing.",409);plan[v.section]=v.text;}
  // This application's canonical PCP is directly editable; there is no PCP approval model.
  await tx.student.update({where:{id:v.studentId},data:{personCentredProfile:plan}});
  await tx.myDayPlanHistory.create({data:{id:v.key,studentId:v.studentId,organisationId:actor.organisationId,section:v.section,beforeText:v.before,afterText:v.text,actorId:actor.id,actorName:actor.name}});
  await tx.auditLog.create({data:{action:"MYDAY_PLAN_EDITED",actorType:"USER",actorId:actor.id,entityType:"Student",entityId:v.studentId,afterValue:{section:v.section,historyId:v.key}}});
 });return mydayJson({saved:true});
});}
