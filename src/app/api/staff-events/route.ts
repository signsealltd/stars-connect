import {NextRequest} from "next/server";
import {z} from "zod";
import {withCapability} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {staffJson} from "@/lib/staff-area-auth";
import {expandRecurrence} from "@/lib/operations-core";
const schema=z.object({id:z.string().uuid().optional(),title:z.string().trim().min(1).max(191),type:z.enum(["MEETING","TRAINING","ADDITIONAL_SHIFT"]),start:z.string().datetime(),end:z.string().datetime(),location:z.string().max(191).default(""),notes:z.string().max(4000).default(""),required:z.boolean().default(true),staffIds:z.array(z.string().uuid()).max(500),allStaff:z.boolean().default(false),weeks:z.number().int().min(1).max(52).default(1),cancel:z.boolean().default(false)}).refine(v=>v.end>v.start,"End must be after start.");
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_VIEW,async user=>staffJson({events:await prisma.operationOccurrence.findMany({where:{organisationId:user.organisationId!,startAt:{gte:new Date(Date.now()-86400000)}},include:{operation:{select:{title:true,type:true}},assignments:{where:{status:"ASSIGNED"},select:{staffId:true}}},orderBy:{startAt:"asc"},take:200})}))}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_MANAGE,async user=>{
 const p=schema.safeParse(await req.json());if(!p.success)return staffJson({error:p.error.issues[0].message},422);const v=p.data;if(new Date(v.start)<new Date())return staffJson({error:"Only future schedules can be changed here."},422);
 const staff=await prisma.staffMember.findMany({where:{active:true,archivedAt:null,...(!v.allStaff?{id:{in:v.staffIds}}:{})},select:{id:true,userId:true}});const ids=staff.map(s=>s.id);
 await prisma.$transaction(async tx=>{
  if(v.id){const old=await tx.operationOccurrence.findFirst({where:{id:v.id,organisationId:user.organisationId!,startAt:{gt:new Date()},status:{not:"COMPLETED"}}});if(!old)throw Error("Future event unavailable");
   const original=await tx.operation.findUniqueOrThrow({where:{id:old.operationId}});
   const edited=await tx.operation.create({data:{organisationId:original.organisationId,title:v.title,type:v.type,description:original.description,internalNotes:original.internalNotes,createdById:user.id}});
   await tx.operationOccurrence.update({where:{id:v.id},data:{operationId:edited.id,seriesId:null,startAt:new Date(v.start),endAt:new Date(v.end),location:v.location,staffVisibleNotes:v.notes,staffConfirmationRequired:v.required,status:v.cancel?"CANCELLED":"PLANNING",cancelledAt:v.cancel?new Date():null}});
   const previous=await tx.operationStaffAssignment.findMany({where:{occurrenceId:v.id,status:"ASSIGNED"},select:{staffId:true}});
   await tx.operationStaffAssignment.updateMany({where:{occurrenceId:v.id,staffId:{notIn:ids}},data:{status:"REMOVED"}});
   for(const staffId of ids)await tx.operationStaffAssignment.upsert({where:{occurrenceId_staffId:{occurrenceId:v.id,staffId}},create:{organisationId:user.organisationId!,occurrenceId:v.id,staffId,createdById:user.id},update:{status:"ASSIGNED",confirmation:"PENDING",responseNote:null}});
   for(const staffId of new Set([...ids,...previous.map(a=>a.staffId)]))await tx.staffPortalNotification.create({data:{staffId,key:crypto.randomUUID(),message:"Your schedule has changed. Please review it.",href:"/staff/schedule"}});
   await tx.auditLog.create({data:{action:"STAFF_EVENT_UPDATED",actorType:"USER",actorId:user.id,entityType:"OperationOccurrence",entityId:v.id,beforeValue:{start:old.startAt.toISOString(),end:old.endAt.toISOString(),status:old.status},afterValue:v}});
  }else{
   const op=await tx.operation.create({data:{organisationId:user.organisationId!,title:v.title,type:v.type,createdById:user.id}});
   for(const dates of expandRecurrence(new Date(v.start),new Date(v.end),{frequency:"WEEKLY",count:v.weeks})){
    const occurrence=await tx.operationOccurrence.create({data:{organisationId:user.organisationId!,operationId:op.id,startAt:dates.startAt,endAt:dates.endAt,location:v.location,staffVisibleNotes:v.notes,staffConfirmationRequired:v.required,status:"PLANNING",assignments:{create:ids.map(staffId=>({organisationId:user.organisationId!,staffId,createdById:user.id}))}}});
    for(const staffId of ids)await tx.staffPortalNotification.create({data:{staffId,key:occurrence.id+":"+staffId,message:"A new schedule entry is available.",href:"/staff/schedule"}});
   }
   await tx.auditLog.create({data:{action:"STAFF_EVENT_CREATED",actorType:"USER",actorId:user.id,entityType:"Operation",entityId:op.id,afterValue:v}});
  }
 },{timeout:30000});return staffJson({ok:true});
})}
