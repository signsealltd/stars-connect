import {applyStaffGrade,canAssignStaffGrade} from "@/lib/staff-grade-access";
import {profileChangeInput} from "@/lib/staff-area-input";
import {NextRequest} from "next/server";
import {z} from "zod";
import {withCapability} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {staffJson} from "@/lib/staff-area-auth";
import {canReviewStaffRequest} from "@/lib/staff-task-access";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_TASKS,async user=>{
 const rows=await prisma.staffRequest.findMany({where:{organisationId:user.organisationId!,status:{not:"DRAFT"}},include:{staff:{select:{displayName:true}},events:{orderBy:{createdAt:"asc"}},documents:{where:{expiresAt:{gt:new Date()}},select:{id:true,filename:true}}},orderBy:{createdAt:"desc"},take:500});
 const allowed=rows.filter(r=>canReviewStaffRequest(user,r));
 const reviewers=await prisma.user.findMany({where:{organisationId:user.organisationId!,active:true},select:{id:true,name:true,role:true,permissionOverrides:true,accessLevelId:true}});
 const levels=await prisma.accessLevel.findMany({where:{active:true}});
 const effectiveReviewers=reviewers.map(r=>{const l=levels.find(l=>l.id===r.accessLevelId);return l?{...r,role:l.baseRole,permissionOverrides:{...Object.fromEntries(Object.values(CAPABILITIES).map(c=>[c,false])),...(l.permissions as Record<string,boolean>)}}:r});
 const staff=await prisma.staffMember.findMany({where:{active:true,archivedAt:null},select:{id:true,displayName:true}});
 const canSchedule=hasCapability(user.role,CAPABILITIES.STAFF_SCHEDULE_VIEW,user.permissionOverrides),canManageSchedule=hasCapability(user.role,CAPABILITIES.STAFF_SCHEDULE_MANAGE,user.permissionOverrides);
 const responses=canSchedule?await prisma.operationStaffAssignment.findMany({where:{organisationId:user.organisationId!,status:"ASSIGNED",occurrence:{staffConfirmationRequired:true,status:{notIn:["CANCELLED","COMPLETED"]}}},select:{id:true,confirmation:true,responseNote:true,staff:{select:{displayName:true}},occurrence:{select:{startAt:true,operation:{select:{title:true}}}}}}):[];
 if(req.nextUrl.searchParams.get("summary")==="1")return staffJson({count:allowed.filter(r=>["NEW","IN_REVIEW","WAITING","CANCELLATION_REQUESTED"].includes(r.status)).length+responses.filter(r=>!["CONFIRMED","REVIEWED"].includes(r.confirmation)).length});
 return staffJson({rows:allowed,staff,responses,canSchedule,canManageSchedule,reviewers:effectiveReviewers.filter(r=>hasCapability(r.role,CAPABILITIES.STAFF_TASKS,r.permissionOverrides)).map(r=>({id:r.id,name:r.name}))});
})}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_TASKS,async user=>{
 const p=z.object({id:z.string().uuid(),action:z.enum(["review","approve","decline","more-info","complete","reopen","cancel","note","assign","acknowledge-response"]),message:z.string().trim().max(6000).default(""),staffVisible:z.boolean().default(true),assignedUserId:z.string().uuid().optional(),dueDate:z.string().date().optional()}).safeParse(await req.json());if(!p.success)return staffJson({error:"Invalid review."},422);const v=p.data;
 if(v.action==="acknowledge-response"){if(!hasCapability(user.role,CAPABILITIES.STAFF_SCHEDULE_MANAGE,user.permissionOverrides))return staffJson({error:"Schedule management permission required."},403);const a=await prisma.operationStaffAssignment.findFirst({where:{id:v.id,organisationId:user.organisationId!,status:"ASSIGNED"}});if(!a)return staffJson({error:"Response unavailable."},404);await prisma.$transaction(async tx=>{await tx.operationStaffAssignment.update({where:{id:a.id},data:{confirmation:"REVIEWED"}});await tx.auditLog.create({data:{action:"STAFF_RESPONSE_REVIEWED",actorType:"USER",actorId:user.id,entityType:"OperationStaffAssignment",entityId:a.id}});await tx.staffPortalNotification.create({data:{staffId:a.staffId,key:crypto.randomUUID(),message:"Your attendance response has been reviewed.",href:"/staff/schedule"}})});return staffJson({ok:true});}
 if(["decline","reopen","cancel","more-info"].includes(v.action)&&!v.message)return staffJson({error:"A reason or message is required."},422);
 return prisma.$transaction(async tx=>{
  const r=await tx.staffRequest.findUnique({where:{id:v.id}});if(!r||!canReviewStaffRequest(user,r))return staffJson({error:"Request unavailable."},404);
  const d=r.details as Record<string,unknown>;let status=r.status;
  if(v.assignedUserId){const reviewer=await tx.user.findUnique({where:{id:v.assignedUserId}});if(reviewer?.accessLevelId){const l=await tx.accessLevel.findFirst({where:{id:reviewer.accessLevelId,active:true}});if(!l)return staffJson({error:"Reviewer access level is inactive."},422);reviewer.role=l.baseRole;reviewer.permissionOverrides={...Object.fromEntries(Object.values(CAPABILITIES).map(c=>[c,false])),...(l.permissions as Record<string,boolean>)}}if(!reviewer?.active||!canReviewStaffRequest(reviewer,r))return staffJson({error:"This reviewer is not authorised or has a conflict of interest."},422);}

  if(v.action==="approve"){
   if(!["LEAVE","PROFILE"].includes(r.type)||!["NEW","IN_REVIEW","WAITING"].includes(r.status))return staffJson({error:"This request cannot be approved."},409);
   if(r.type==="PROFILE"){const proposed=profileChangeInput.safeParse(d.proposed);if(!proposed.success||!Object.keys(proposed.data).length)return staffJson({error:"Use the staff profile to apply this requested change, then record the outcome here."},422);if(proposed.data.jobRole&&!canAssignStaffGrade(user))return staffJson({error:"User-management permission is required to approve a staff grade change."},403);const updated=await tx.staffMember.update({where:{id:r.staffId},data:proposed.data});if(proposed.data.jobRole)await applyStaffGrade(tx,updated,user);status="APPROVED";}else{const a=await tx.staffScheduleException.create({data:{staffId:r.staffId,organisationId:r.organisationId,startDate:new Date(String(d.startDate)),endDate:new Date(String(d.endDate)),startTime:d.startTime?String(d.startTime):null,endTime:d.endTime?String(d.endTime):null,type:d.category==="UNPAID_LEAVE"?"UNPAID_LEAVE":"ANNUAL_LEAVE",approvalStatus:"APPROVED",notes:"Approved leave",createdById:user.id,approvedById:user.id}});await tx.staffRequest.update({where:{id:r.id},data:{absenceId:a.id}});status="APPROVED";}
  }else if(v.action==="cancel"){
   if(r.type!=="LEAVE"||!["APPROVED","CANCELLATION_REQUESTED"].includes(r.status))return staffJson({error:"This leave cannot be cancelled."},409);
   if(r.absenceId)await tx.staffScheduleException.update({where:{id:r.absenceId},data:{approvalStatus:"REJECTED"}});status="CANCELLED";
  }else if(v.action==="assign"){
   if(!v.assignedUserId)return staffJson({error:"Select a reviewer."},422);
  }else if(v.action!=="note"){
   if(["APPROVED","CANCELLATION_REQUESTED"].includes(status))return staffJson({error:"Use the controlled cancellation action for approved leave."},409);
   status=({review:"IN_REVIEW",decline:"DECLINED","more-info":"WAITING",complete:"COMPLETED",reopen:"NEW"} as Record<string,string>)[v.action]||status;
  }
  await tx.staffRequest.update({where:{id:r.id},data:{status,...(v.assignedUserId?{assignedUserId:v.assignedUserId}:{}),...(v.dueDate?{dueDate:new Date(v.dueDate)}:{})}});
  await tx.staffRequestEvent.create({data:{requestId:r.id,actorId:user.id,action:v.action,message:v.message||status,staffVisible:v.staffVisible}});
  await tx.staffPortalNotification.create({data:{staffId:r.staffId,key:crypto.randomUUID(),message:"There is an update to your request.",href:"/staff/requests"}});
  return staffJson({ok:true});
 },{isolationLevel:"Serializable"});
})}
