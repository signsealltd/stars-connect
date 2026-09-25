import {NextRequest} from "next/server";
import {z} from "zod";
import {withCapability} from "@/lib/api";
import {CAPABILITIES as C,hasCapability} from "@/lib/permission-catalog";
import {prisma} from "@/lib/prisma";
import {staffJson} from "@/lib/staff-area-auth";
import {RequestError} from "@/lib/request-error";
import {canChangeTask,nextTaskStatus} from "@/lib/task-lifecycle";
const input=z.object({id:z.string().uuid(),source:z.enum(["operational","premises","compliance"]),action:z.enum(["complete","archive","reopen"]),expectedStatus:z.string().min(1),reason:z.string().trim().min(3,"Enter a short completion note or reason.").max(3000)});
export async function POST(req:NextRequest){return withCapability(req,C.STAFF_TASKS,async user=>{
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return staffJson({error:parsed.error.issues[0].message},422);const v=parsed.data;
 const result=await prisma.$transaction(async tx=>{
  const task=v.source==="operational"?await tx.operationalTask.findUnique({where:{id:v.id}}):v.source==="premises"?await tx.premisesCorrectiveAction.findUnique({where:{id:v.id}}):await tx.complianceAction.findFirst({where:{id:v.id,organisationId:user.organisationId||"",...(!hasCapability(user.role,C.COMPLIANCE_SENSITIVE_VIEW,user.permissionOverrides)?{sourceId:null}:{})},include:{attachments:{select:{id:true}}}});
  if(!task)throw new RequestError("Task unavailable.",404);
  if(!canChangeTask(user,v.source,"sourceKey" in task?task.sourceKey:undefined))throw new RequestError("Use the authorised source workflow for this task.",403);
  if(task.status!==v.expectedStatus)throw new RequestError("This task has changed. Refresh the queue and try again.",409);
  let status=nextTaskStatus(v.source,v.action,{status:task.status,...("verificationRequired" in task?{verificationRequired:task.verificationRequired,completedById:task.completedById,attachmentCount:"attachments" in task?task.attachments.length:task.evidenceUrl?1:0}:{})},user.id);
  if(v.source!=="operational"&&v.action==="reopen"&&["CANCELLED","ARCHIVED"].includes(task.status)){const previous=await tx.auditLog.findFirst({where:{entityType:v.source==="premises"?"PremisesCorrectiveAction":"ComplianceAction",entityId:v.id,action:"TASK_ARCHIVE"},orderBy:{createdAt:"desc"}});if((previous?.beforeValue as Record<string,unknown>)?.status==="AWAITING_EVIDENCE")status="AWAITING_EVIDENCE";}
  if(v.source==="operational"){
   await tx.operationalTask.update({where:{id:v.id},data:{status}});
   await tx.operationalTaskEvent.create({data:{taskId:v.id,actorId:user.id,action:v.action.toUpperCase(),details:{before:task.status,after:status,reason:v.reason}}});
  }else if(v.source==="premises")await tx.premisesCorrectiveAction.update({where:{id:v.id},data:{status,completedAt:["COMPLETED","AWAITING_VERIFICATION"].includes(status)?new Date():null,completedById:v.action==="complete"?("completedById" in task&&task.status==="AWAITING_VERIFICATION"?task.completedById:user.id):null,verifiedById:status==="COMPLETED"&&"verificationRequired" in task&&task.verificationRequired?user.id:null,verifiedAt:status==="COMPLETED"&&"verificationRequired" in task&&task.verificationRequired?new Date():null,updatedById:user.id}});
  else await tx.complianceAction.update({where:{id:v.id},data:{status:status as "OPEN"|"COMPLETED"|"CANCELLED"|"AWAITING_VERIFICATION"|"AWAITING_EVIDENCE",completionNotes:v.reason,...(v.action==="complete"?{completedById:task.status==="AWAITING_VERIFICATION"&&"completedById" in task?task.completedById:user.id,completedAt:new Date(),...(status==="COMPLETED"&&"verificationRequired" in task&&task.verificationRequired?{verifiedById:user.id,verifiedAt:new Date()}:{})}:v.action==="reopen"?{completedById:null,completedAt:null,verifiedById:null,verifiedAt:null}:{})}});
  await tx.auditLog.create({data:{action:`TASK_${v.action.toUpperCase()}`,actorType:"USER",actorId:user.id,entityType:v.source==="operational"?"OperationalTask":v.source==="premises"?"PremisesCorrectiveAction":"ComplianceAction",entityId:v.id,beforeValue:{status:task.status},afterValue:{status,reason:v.reason}}});
  return {id:v.id,status};
 },{isolationLevel:"Serializable"});return staffJson(result);
})}
