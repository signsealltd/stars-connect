import type {Prisma,StaffMember,User} from "@prisma/client";
import bcrypt from "bcryptjs";
import {randomBytes} from "crypto";
import {STAFF_GRADES,STAFF_GRADE_ROLES,staffGrade,type StaffGrade} from "./staff-grades";
import {CAPABILITIES,hasCapability} from "./permission-catalog";
import {AccessError} from "./security";
export async function ensureStaffGrades(tx:Prisma.TransactionClient,actorId:string){
 const old=await tx.accessLevel.findUnique({where:{name:'Care Assistant'}});
 if(old&&!await tx.accessLevel.findUnique({where:{name:'Support Worker'}}))await tx.accessLevel.update({where:{id:old.id},data:{name:'Support Worker'}});
 for(const name of STAFF_GRADES){const baseRole=STAFF_GRADE_ROLES[name];const defaults=Object.fromEntries(Object.values(CAPABILITIES).map(c=>[c,hasCapability(baseRole,c)]));const level=await tx.accessLevel.upsert({where:{name},update:{},create:{name,baseRole,permissions:defaults,updatedById:actorId}});const configured=(level.permissions||{}) as Record<string,boolean>;if(Object.keys(defaults).some(c=>!(c in configured)))await tx.accessLevel.update({where:{id:level.id},data:{permissions:{...defaults,...configured}}})}
}
export function canAssignStaffGrade(actor:Pick<User,'role'|'permissionOverrides'>){return hasCapability(actor.role,CAPABILITIES.USERS_MANAGE,actor.permissionOverrides)}
export async function applyStaffGrade(tx:Prisma.TransactionClient,staff:StaffMember,actor:User){
 const grade=staffGrade(staff.jobRole);if(!grade)throw new Error('Choose a current staff grade.');
 await ensureStaffGrades(tx,actor.id);
 const level=await tx.accessLevel.findUniqueOrThrow({where:{name:grade}});if(!level.active)throw new Error('This staff access level is disabled.');
 const linked=staff.userId?await tx.user.findUnique({where:{id:staff.userId}}):await tx.user.findUnique({where:{email:staff.email.toLowerCase()}});
 if((grade==="Administrator"||linked?.role==="ADMINISTRATOR")&&actor.role!=="ADMINISTRATOR")throw new AccessError(403,"FORBIDDEN");
 if(linked&&linked.organisationId!==actor.organisationId)throw new AccessError(403,'FORBIDDEN');
 // A staff profile cannot be used to change the current operator's own permissions.
 if(linked?.id===actor.id&&(linked.role!==level.baseRole||linked.accessLevelId!==level.id))throw new AccessError(403,'FORBIDDEN');
 if(!canAssignStaffGrade(actor))throw new AccessError(403,'FORBIDDEN');
 const account=linked?await tx.user.update({where:{id:linked.id},data:{accessLevelId:level.id,role:level.baseRole,permissionOverrides:level.permissions!}}):await tx.user.create({data:{username:'staff.'+staff.id.replaceAll('-','').slice(0,24),email:staff.email.toLowerCase(),name:staff.displayName,organisationId:actor.organisationId,active:staff.active,passwordHash:await bcrypt.hash(randomBytes(32).toString('base64url'),12),role:level.baseRole,accessLevelId:level.id,permissionOverrides:level.permissions!}});
 await tx.session.deleteMany({where:{userId:account.id}});
 await tx.staffPortalSession.deleteMany({where:{accountId:staff.id}});
 await tx.staffAccessEvent.create({data:{staffId:staff.id,actorId:actor.id,action:'GRADE_ASSIGNED',reason:'Job title set to '+grade}});
 return tx.staffMember.update({where:{id:staff.id},data:{jobRole:grade,accessLevelId:level.id,userId:account.id}});
}
export function gradeRole(name:StaffGrade){return STAFF_GRADE_ROLES[name]}
