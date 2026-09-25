import type {User} from "@prisma/client";
import {prisma} from "./prisma";
import {canChangeTask,type TaskSource} from "./task-lifecycle";
import {RequestError} from "./request-error";
import {CAPABILITIES as C,hasCapability} from "./permissions";
export async function taskOwners(user:User,source?:TaskSource){const users=await prisma.user.findMany({where:{active:true,organisationId:user.organisationId||""}});const levels=await prisma.accessLevel.findMany({where:{active:true}});const cap=source==="premises"?C.PREMISES_VIEW:source==="compliance"?C.COMPLIANCE_VIEW:null;const eligible=users.filter(u=>{const level=levels.find(l=>l.id===u.accessLevelId);if(u.accessLevelId&&!level&&u.role!=="ADMINISTRATOR")return false;const overrides=level?{...Object.fromEntries(Object.values(C).map(c=>[c,false])),...(level.permissions as Record<string,boolean>)}:u.permissionOverrides;return !cap||hasCapability(u.role==="ADMINISTRATOR"?u.role:level?.baseRole||u.role,cap,overrides)});return prisma.staffMember.findMany({where:{active:true,archivedAt:null,userId:{in:eligible.map(u=>u.id)}},select:{id:true,displayName:true,userId:true,jobRole:true},orderBy:{displayName:"asc"}})}
export async function assignTask(user:User,input:{id:string;source:TaskSource;userId:string;expectedOwnerId:string|null;reason?:string}){
 if(!hasCapability(user.role,C.STAFF_TASKS,user.permissionOverrides))throw new RequestError("Task access required.",403);
 const eligible=await taskOwners(user,input.source);if(!eligible.some(p=>p.userId===input.userId))throw new RequestError("Choose an active staff account with access to this task area.",422);
 return prisma.$transaction(async tx=>{
 const person=await tx.staffMember.findFirst({where:{AND:[{userId:input.userId}],active:true,archivedAt:null,userId:{in:(await prisma.user.findMany({where:{active:true,organisationId:user.organisationId||""},select:{id:true}})).map(u=>u.id)}}});if(!person||person.userId!==input.userId)throw new RequestError("Choose an active staff account.",422);
 const row=input.source==="operational"?await tx.operationalTask.findUnique({where:{id:input.id}}):input.source==="premises"?await tx.premisesCorrectiveAction.findUnique({where:{id:input.id}}):await tx.complianceAction.findFirst({where:{id:input.id,organisationId:user.organisationId||"",...(!hasCapability(user.role,C.COMPLIANCE_SENSITIVE_VIEW,user.permissionOverrides)?{sourceId:null}:{})}});
 if(!row)throw new RequestError("Task unavailable.",404);if(!canChangeTask(user,input.source,"sourceKey" in row?row.sourceKey:undefined))throw new RequestError("You cannot assign this task.",403);
 const oldPerson="assignedStaffId" in row&&row.assignedStaffId?await tx.staffMember.findUnique({where:{id:row.assignedStaffId}}):null;
 const previous="assignedUserId" in row?row.assignedUserId:oldPerson?.userId||null;
 if(previous!==input.expectedOwnerId)throw new RequestError("The owner has changed. Refresh before confirming.",409);
 const details={previousOwnerId:previous,newOwnerId:person.userId,previousOwner:"owner" in row?row.owner:"assignedTo" in row?row.assignedTo:previous,newOwner:person.displayName,reason:input.reason||"Owner reassigned"};
 if(input.source==="operational"){await tx.operationalTask.update({where:{id:row.id},data:{assignedStaffId:person.id,owner:person.displayName}});await tx.operationalTaskEvent.create({data:{taskId:row.id,actorId:user.id,action:"OWNER_CHANGED",details}})}else if(input.source==="premises")await tx.premisesCorrectiveAction.update({where:{id:row.id},data:{assignedUserId:person.userId,assignedTo:person.displayName,updatedById:user.id}});else await tx.complianceAction.update({where:{id:row.id},data:{assignedUserId:person.userId}});
 await tx.auditLog.create({data:{action:"TASK_OWNER_CHANGED",actorType:"USER",actorId:user.id,entityType:input.source==="operational"?"OperationalTask":input.source==="premises"?"PremisesCorrectiveAction":"ComplianceAction",entityId:row.id,beforeValue:{ownerId:previous},afterValue:details}});
 await tx.staffPortalNotification.create({data:{staffId:person.id,key:crypto.randomUUID(),message:`Task assigned: ${row.title}`.slice(0,191),href:`/staff/tasks`}});
 return {ok:true,owner:person.displayName};
 },{isolationLevel:"Serializable"});
}
