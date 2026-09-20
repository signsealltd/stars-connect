import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {requireOrganisation} from "@/lib/compliance-service";
import {localDateAsDatabaseDate} from "@/lib/dates";
import {staffAbsenceInput} from "@/lib/staff-planning";
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_MANAGE,async user=>{
 const parsed=staffAbsenceInput.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Choose a staff member, absence type and valid dates.",422);
 const input=parsed.data,organisationId=requireOrganisation(user);
 const staff=await prisma.staffMember.findFirst({where:{id:input.staffId,archivedAt:null}});if(!staff)return jsonError("Staff member not found.",404);
 const record=await prisma.$transaction(async tx=>{
  const created=await tx.staffScheduleException.create({data:{organisationId,staffId:input.staffId,type:input.type,startDate:localDateAsDatabaseDate(input.startDate),endDate:localDateAsDatabaseDate(input.endDate),notes:input.notes,approvalStatus:"APPROVED",createdById:user.id,approvedById:user.id}});
  await tx.auditLog.create({data:{action:"STAFF_ABSENCE_RECORDED",actorType:"USER",actorId:user.id,entityType:"StaffScheduleException",entityId:created.id,afterValue:{staffId:input.staffId,type:input.type,startDate:input.startDate,endDate:input.endDate}}});return created;
 });return NextResponse.json({record},{status:201});
});}
export async function PATCH(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_MANAGE,async user=>{
 const parsed=z.object({id:z.string().uuid()}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Choose an absence record.",422);
 const organisationId=requireOrganisation(user);const updated=await prisma.$transaction(async tx=>{
  const record=await tx.staffScheduleException.findFirst({where:{id:parsed.data.id,organisationId,type:{in:["ANNUAL_LEAVE","SICKNESS"]},approvalStatus:"APPROVED"}});if(!record)return false;
  await tx.staffScheduleException.update({where:{id:record.id},data:{approvalStatus:"REJECTED"}});
  await tx.auditLog.create({data:{action:"STAFF_ABSENCE_CANCELLED",actorType:"USER",actorId:user.id,entityType:"StaffScheduleException",entityId:record.id,afterValue:{staffId:record.staffId}}});return true;
 });return updated?NextResponse.json({ok:true}):jsonError("Absence not found.",404);
});}

export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_VIEW,async user=>{const organisationId=requireOrganisation(user);const [staff,records]=await Promise.all([prisma.staffMember.findMany({where:{archivedAt:null},select:{id:true,displayName:true},orderBy:{displayName:"asc"}}),prisma.staffScheduleException.findMany({where:{organisationId,type:{in:["ANNUAL_LEAVE","SICKNESS"]},approvalStatus:"APPROVED"},include:{staff:{select:{displayName:true}}},orderBy:{startDate:"desc"},take:100})]);return NextResponse.json({staff:staff.map(item=>({id:item.id,name:item.displayName})),records:records.map(item=>({id:item.id,name:item.staff.displayName,type:item.type,startDate:item.startDate,endDate:item.endDate})),canManage:hasCapability(user.role,CAPABILITIES.STAFF_SCHEDULE_MANAGE,user.permissionOverrides)});});}
