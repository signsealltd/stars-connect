import {NextRequest,NextResponse} from "next/server";

import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {requireOrganisation} from "@/lib/compliance-service";
import {localDateAsDatabaseDate} from "@/lib/dates";
import {absenceCreateInput,absenceEditInput,absenceCancelInput} from "@/lib/staff-absence-input";
import {shiftDate} from "@/lib/staff-absence-summary";
import {jsonValue} from "@/lib/action-notifications";
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_MANAGE,async user=>{
 const parsed=absenceCreateInput.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Choose a staff member, absence type and valid dates.",422);
 const input=parsed.data,organisationId=requireOrganisation(user);
 const staff=await prisma.staffMember.findFirst({where:{id:input.staffId,archivedAt:null}});if(!staff)return jsonError("Staff member not found.",404);
 const record=await prisma.$transaction(async tx=>{
  const created=await tx.staffScheduleException.create({data:{organisationId,staffId:input.staffId,type:input.type,startDate:localDateAsDatabaseDate(input.startDate),endDate:localDateAsDatabaseDate(input.endDate),notes:input.notes,startTime:input.startTime||null,endTime:input.endTime||null,bradfordExcluded:input.bradfordExcluded,bradfordReason:input.bradfordExcluded?input.bradfordReason:null,approvalStatus:"APPROVED",createdById:user.id,approvedById:user.id}});
  await tx.auditLog.create({data:{action:"STAFF_ABSENCE_RECORDED",actorType:"USER",actorId:user.id,entityType:"StaffScheduleException",entityId:created.id,afterValue:jsonValue(input)}});return created;
 });return NextResponse.json({record},{status:201});
});}
export async function PATCH(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_MANAGE,async user=>{
 const body=await req.json().catch(()=>null),editing=body?.values!==undefined;
 const parsed=editing?absenceEditInput.safeParse(body):absenceCancelInput.safeParse(body);
 if(!parsed.success)return jsonError(parsed.error.issues[0].message,422);
 const input=parsed.data,organisationId=requireOrganisation(user);
 return prisma.$transaction(async tx=>{
  const record=await tx.staffScheduleException.findFirst({where:{id:input.id,organisationId,type:{in:["ANNUAL_LEAVE","SICKNESS"]},approvalStatus:"APPROVED"}});
  if(!record)return jsonError("Absence not found.",404);
  if(record.updatedAt.toISOString()!==input.updatedAt)return jsonError("This absence changed. Reload before editing.",409);
  const values=editing?absenceEditInput.parse(body).values:null;
  if(values&&(values.staffId!==record.staffId||values.type!==record.type))return jsonError("Staff member and absence type cannot be changed. Cancel and record a new absence instead.",422);
  const data=values?{startDate:localDateAsDatabaseDate(values.startDate),endDate:localDateAsDatabaseDate(values.endDate),startTime:values.startTime||null,endTime:values.endTime||null,notes:values.notes,bradfordExcluded:values.bradfordExcluded,bradfordReason:values.bradfordExcluded?values.bradfordReason:null}:{approvalStatus:"REJECTED" as const};
  const updated=await tx.staffScheduleException.updateMany({where:{id:record.id,updatedAt:record.updatedAt,approvalStatus:"APPROVED"},data});
  if(!updated.count)return jsonError("This absence changed. Reload before editing.",409);
  const requests=await tx.staffRequest.findMany({where:{absenceId:record.id,organisationId}});
  for(const request of requests){
   await tx.staffRequest.update({where:{id:request.id},data:values?{details:jsonValue({...request.details as object,startDate:values.startDate,endDate:values.endDate,startTime:values.startTime||null,endTime:values.endTime||null,...((request.details as Record<string,unknown>).actualReturn?{actualReturn:shiftDate(values.endDate,1)}:{})})}:{status:"CANCELLED"}});
   await tx.staffRequestEvent.create({data:{requestId:request.id,actorId:user.id,action:values?"ABSENCE_EDITED":"ABSENCE_CANCELLED",message:values?"Recorded absence dates updated by management.":"Recorded absence cancelled by management.",staffVisible:true}});
  }
  await tx.auditLog.create({data:{action:values?"STAFF_ABSENCE_UPDATED":"STAFF_ABSENCE_CANCELLED",actorType:"USER",actorId:user.id,entityType:"StaffScheduleException",entityId:record.id,beforeValue:jsonValue(record),afterValue:jsonValue({...data,reason:input.reason})}});
  return NextResponse.json({ok:true});
 },{isolationLevel:"Serializable"});
});}

export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_VIEW,async user=>{const organisationId=requireOrganisation(user),staffId=req.nextUrl.searchParams.get("staffId")||undefined;const [staff,records]=await Promise.all([prisma.staffMember.findMany({where:{archivedAt:null},select:{id:true,displayName:true},orderBy:{displayName:"asc"}}),prisma.staffScheduleException.findMany({where:{organisationId,...(staffId?{staffId}:{}),type:{in:["ANNUAL_LEAVE","SICKNESS"]},approvalStatus:"APPROVED"},include:{staff:{select:{displayName:true}}},orderBy:{startDate:"desc"},...(staffId?{}:{take:100})})]);return NextResponse.json({staff:staff.map(item=>({id:item.id,name:item.displayName})),records:records.map(item=>({id:item.id,staffId:item.staffId,name:item.staff.displayName,type:item.type,startDate:item.startDate,endDate:item.endDate,startTime:item.startTime,endTime:item.endTime,updatedAt:item.updatedAt,...(hasCapability(user.role,CAPABILITIES.STAFF_SCHEDULE_MANAGE,user.permissionOverrides)?{notes:item.notes,bradfordExcluded:item.bradfordExcluded,bradfordReason:item.bradfordReason}:{})})),canManage:hasCapability(user.role,CAPABILITIES.STAFF_SCHEDULE_MANAGE,user.permissionOverrides)});});}
