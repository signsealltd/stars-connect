import type {User} from "@prisma/client";
import {Prisma} from "@prisma/client";
import {fromZonedTime} from "date-fns-tz";
import {prisma} from "./prisma";
import {requireOrganisation} from "./compliance-service";
import {CAPABILITIES,hasCapability} from "./permissions";
import {APP_TIME_ZONE} from "./dates";
import {RequestError} from "./request-error";
export type ActivityEdit={id:string;updatedAt:string;title:string;type:string;date:string;startTime:string;endTime:string;location?:string;description?:string;staffIds:string[];studentIds:string[]};
export const editableActivity=(status:string)=>!["ACTIVE","POST_OPERATION_REVIEW","COMPLETED","CANCELLED"].includes(status);
export async function editCalendarActivity(user:User,input:ActivityEdit){
 const organisationId=requireOrganisation(user);
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM OperationOccurrence WHERE id=${input.id} AND organisationId=${organisationId} FOR UPDATE`;
  const old=await tx.operationOccurrence.findFirst({where:{id:input.id,organisationId},include:{operation:true,assignments:true,attendees:true}});
  if(!old)throw new RequestError("Activity not found.",404);
  if(old.updatedAt.toISOString()!==input.updatedAt)throw new RequestError("This activity changed. Close and reopen it before editing.",409);
  if(!editableActivity(old.status))throw new RequestError("An activity already underway, completed or cancelled cannot be edited here.",409);
  const staffBefore=old.assignments.filter(a=>a.status==="ASSIGNED").map(a=>a.staffId),clientsBefore=old.attendees.filter(a=>a.status!=="CANCELLED").map(a=>a.studentId);
  const different=(a:string[],b:string[])=>[...a].sort().join()!==[...b].sort().join();
  if(different(staffBefore,input.staffIds)&&!hasCapability(user.role,CAPABILITIES.OPERATIONS_ASSIGN_STAFF,user.permissionOverrides))throw new RequestError("You do not have permission to change staff assignments.",403);
  if(different(clientsBefore,input.studentIds)&&!hasCapability(user.role,CAPABILITIES.OPERATIONS_ASSIGN_ATTENDEES,user.permissionOverrides))throw new RequestError("You do not have permission to change client assignments.",403);
  const startAt=fromZonedTime(`${input.date}T${input.startTime}:00`,APP_TIME_ZONE),endAt=fromZonedTime(`${input.date}T${input.endTime}:00`,APP_TIME_ZONE),day=new Date(input.date);
  if(!Number.isFinite(startAt.getTime())||endAt<=startAt)throw new RequestError("Check the date and times.");
  if(await tx.staffMember.count({where:{id:{in:input.staffIds},active:true,archivedAt:null,startDate:{lte:day},OR:[{endDate:null},{endDate:{gte:day}}]}})!==input.staffIds.length)throw new RequestError("A selected staff member is unavailable on this date.");
  if(await tx.student.count({where:{id:{in:input.studentIds},active:true,archivedAt:null}})!==input.studentIds.length)throw new RequestError("A selected client is no longer active. Remove them before saving.");
  if(input.staffIds.length&&await tx.operationStaffAssignment.findFirst({where:{organisationId,staffId:{in:input.staffIds},status:"ASSIGNED",occurrence:{id:{not:old.id},status:{notIn:["COMPLETED","CANCELLED"]},startAt:{lt:endAt},endAt:{gt:startAt}}}}))throw new RequestError("A selected staff member already has an activity at this time.",409);
  let operationId=old.operationId;
  if(await tx.operationOccurrence.count({where:{operationId}})>1){const operation=await tx.operation.create({data:{organisationId,title:input.title,type:input.type,description:input.description,internalNotes:old.operation.internalNotes,createdById:user.id}});operationId=operation.id;}
  else await tx.operation.update({where:{id:operationId},data:{title:input.title,type:input.type,description:input.description}});
  await tx.operationStaffAssignment.updateMany({where:{occurrenceId:old.id,staffId:{notIn:input.staffIds}},data:{status:"REMOVED"}});
  for(const staffId of input.staffIds)await tx.operationStaffAssignment.upsert({where:{occurrenceId_staffId:{occurrenceId:old.id,staffId}},create:{organisationId,occurrenceId:old.id,staffId,createdById:user.id},update:{status:"ASSIGNED",confirmation:"PENDING",responseNote:null}});
  await tx.operationAttendee.updateMany({where:{occurrenceId:old.id,studentId:{notIn:input.studentIds}},data:{status:"CANCELLED"}});
  for(const studentId of input.studentIds)await tx.operationAttendee.upsert({where:{occurrenceId_studentId:{occurrenceId:old.id,studentId}},create:{organisationId,occurrenceId:old.id,studentId,createdById:user.id},update:{status:"PLANNED"}});
  const updated=await tx.operationOccurrence.update({where:{id:old.id},data:{operationId,seriesId:operationId!==old.operationId?null:old.seriesId,startAt,endAt,location:input.location||null,staffVisibleNotes:input.description||null,status:"PLANNING",readiness:"ACTION_REQUIRED"}});
  for(const staffId of new Set([...staffBefore,...input.staffIds]))await tx.staffPortalNotification.create({data:{staffId,key:crypto.randomUUID(),message:input.staffIds.includes(staffId)?"An assigned activity has changed. Please review your schedule.":"An activity assignment has been removed. Please review your schedule.",href:"/staff/schedule"}});
  await tx.auditLog.create({data:{action:"CALENDAR_ACTIVITY_EDITED",actorType:"USER",actorId:user.id,entityType:"OperationOccurrence",entityId:old.id,beforeValue:JSON.parse(JSON.stringify({title:old.operation.title,type:old.operation.type,description:old.operation.description,startAt:old.startAt,endAt:old.endAt,location:old.location,status:old.status,staffIds:staffBefore,studentIds:clientsBefore,assignments:old.assignments,attendees:old.attendees})),afterValue:{...input,status:"PLANNING",readiness:"ACTION_REQUIRED"}}});
  return updated;
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});
}
