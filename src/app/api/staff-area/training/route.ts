import {NextRequest} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withStaff,staffJson} from "@/lib/staff-area-auth";
import {CAPABILITIES} from "@/lib/permissions";
export async function POST(req:NextRequest){return withStaff(req,async i=>{
 const p=z.object({key:z.string().uuid(),courseName:z.string().trim().min(1).max(191),provider:z.string().max(191).default(""),completedDate:z.string().date(),expiryDate:z.string().date().optional(),certificateReference:z.string().max(191).default("")}).safeParse(await req.json());if(!p.success)return staffJson({error:"Check the course name and dates."},422);const v=p.data;
 if(v.completedDate>new Date().toISOString().slice(0,10)||v.expiryDate&&v.expiryDate<v.completedDate)return staffJson({error:"Check completion and expiry dates."},422);
 const existing=await prisma.staffTrainingRecord.findUnique({where:{id:v.key}});if(existing)return existing.staffId===i.staff.id?staffJson({id:existing.id}):staffJson({error:"Unable to save this record."},409);
 const record=await prisma.$transaction(async tx=>{const r=await tx.staffTrainingRecord.create({data:{id:v.key,staffId:i.staff.id,courseName:v.courseName,provider:v.provider,completedDate:new Date(v.completedDate),expiryDate:v.expiryDate?new Date(v.expiryDate):null,certificateReference:v.certificateReference,createdById:i.user.id,updatedById:i.user.id}});await tx.auditLog.create({data:{action:"STAFF_OWN_TRAINING_ADDED",actorType:"USER",actorId:i.user.id,entityType:"StaffTrainingRecord",entityId:r.id,afterValue:{staffId:i.staff.id,courseName:v.courseName}}});return r});return staffJson({id:record.id},201);
},CAPABILITIES.STAFF_TRAINING)}
