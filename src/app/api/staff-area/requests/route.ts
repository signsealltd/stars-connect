import {NextRequest} from "next/server";
import {z} from "zod";
import {withStaff,staffJson} from "@/lib/staff-area-auth";
import {requestInput} from "@/lib/staff-area-input";
import {prisma} from "@/lib/prisma";
import {CAPABILITIES} from "@/lib/permissions";
export async function POST(req:NextRequest){return withStaff(req,async i=>{
 const parsed=requestInput.safeParse(await req.json());if(!parsed.success)return staffJson({error:parsed.error.issues[0].message},422);
 const {key,involvedUserIds,...details}=parsed.data;
 const existing=await prisma.staffRequest.findUnique({where:{idempotencyKey:key}});if(existing)return existing.staffId===i.staff.id?staffJson({id:existing.id}):staffJson({error:"Request could not be submitted."},409);
 const created=await prisma.$transaction(async tx=>{
  const r=await tx.staffRequest.create({data:{staffId:i.staff.id,organisationId:i.user.organisationId!,idempotencyKey:key,type:details.type,details,involvedUserIds,status:details.draft?"DRAFT":"NEW",events:{create:{actorId:i.user.id,action:details.draft?"DRAFT":"SUBMITTED",message:details.draft?"Draft saved":"Request submitted",staffVisible:true}}}});
  if(r.type==="SICKNESS"&&!details.draft){const absence=await tx.staffScheduleException.create({data:{organisationId:i.user.organisationId!,staffId:i.staff.id,startDate:new Date(details.startDate!),endDate:new Date(details.endDate!),type:"SICKNESS",approvalStatus:"APPROVED",notes:"Sickness absence",createdById:i.user.id,approvedById:i.user.id}});await tx.staffRequest.update({where:{id:r.id},data:{absenceId:absence.id}})}
  return r;
 });return staffJson({id:created.id},201);
},CAPABILITIES.STAFF_OWN_REQUEST)}
export async function PATCH(req:NextRequest){return withStaff(req,async i=>{
 const p=z.object({id:z.string().uuid(),action:z.enum(["withdraw","reply","cancel-request","return","submit-draft","save-draft","extend"]),message:z.string().trim().max(6000).default(""),returnDate:z.string().date().optional(),declaration:z.boolean().optional()}).safeParse(await req.json());if(!p.success)return staffJson({error:"Check your request."},422);
 const v=p.data;
 return prisma.$transaction(async tx=>{
  const r=await tx.staffRequest.findFirst({where:{id:v.id,staffId:i.staff.id,organisationId:i.user.organisationId!}});if(!r)return staffJson({error:"Request unavailable."},404);
  let status=r.status;
  if(v.action==="withdraw"){if(!["NEW","WAITING","DRAFT"].includes(status))return staffJson({error:"Ask your manager to amend an approved request."},409);status="WITHDRAWN";if(r.absenceId)await tx.staffScheduleException.update({where:{id:r.absenceId},data:{approvalStatus:"REJECTED"}})}
  if(v.action==="cancel-request"){if(status!=="APPROVED")return staffJson({error:"Only approved leave can be cancelled."},409);status="CANCELLATION_REQUESTED"}
  if(v.action==="reply"){if(r.status==="DRAFT")return staffJson({error:"Edit the draft, then confirm its declaration before submitting."},409);if(!v.message)return staffJson({error:"Enter your update."},422);status=["APPROVED","CANCELLATION_REQUESTED"].includes(r.status)?r.status:"NEW"}
  if(v.action==="save-draft"){if(r.status!=="DRAFT")return staffJson({error:"Only drafts can be edited."},409);await tx.staffRequest.update({where:{id:r.id},data:{details:{...(r.details as Record<string,unknown>),selfCertification:v.message}}});}
  if(v.action==="extend"){const d=r.details as Record<string,unknown>;if(r.type!=="SICKNESS"||!r.absenceId||!v.returnDate||v.returnDate<String(d.startDate)||Date.parse(v.returnDate)-Date.parse(String(d.startDate))>366*86400000)return staffJson({error:"Choose a valid expected last day of sickness."},422);await tx.staffRequest.update({where:{id:r.id},data:{details:{...d,endDate:v.returnDate,ongoing:true}}});await tx.staffScheduleException.update({where:{id:r.absenceId},data:{endDate:new Date(v.returnDate),approvalStatus:"APPROVED"}});status="NEW";}
  if(v.action==="submit-draft"){
   if(status!=="DRAFT"||!v.declaration)return staffJson({error:"Confirm the declaration before submitting."},422);status="NEW";
   const d=r.details as Record<string,unknown>;await tx.staffRequest.update({where:{id:r.id},data:{details:{...d,declaration:true,draft:false}}});
   if(r.type==="SICKNESS"){const a=await tx.staffScheduleException.create({data:{organisationId:r.organisationId,staffId:r.staffId,startDate:new Date(String(d.startDate)),endDate:new Date(String(d.endDate)),type:"SICKNESS",approvalStatus:"APPROVED",notes:"Sickness absence",createdById:i.user.id}});await tx.staffRequest.update({where:{id:r.id},data:{absenceId:a.id}})}
  }
  if(v.action==="return"){
   if(r.type!=="SICKNESS"||!v.returnDate||!r.absenceId)return staffJson({error:"Choose your actual return date."},422);
   const d=r.details as Record<string,unknown>;if((v.returnDate<String(d.startDate)||v.returnDate>new Date().toISOString().slice(0,10)))return staffJson({error:"Return must be after sickness started."},422);
   await tx.staffRequest.update({where:{id:r.id},data:{details:{...d,actualReturn:v.returnDate,ongoing:false}}});
   await tx.staffScheduleException.update({where:{id:r.absenceId},data:v.returnDate===d.startDate?{approvalStatus:"REJECTED"}:{endDate:new Date(Date.parse(v.returnDate)-86400000)}});status="NEW";
  }
  await tx.staffRequest.update({where:{id:r.id},data:{status}});await tx.staffRequestEvent.create({data:{requestId:r.id,actorId:i.user.id,action:v.action,message:v.message||v.returnDate||v.action,staffVisible:true}});return staffJson({ok:true});
 },{isolationLevel:"Serializable"});
},CAPABILITIES.STAFF_OWN_REQUEST)}
