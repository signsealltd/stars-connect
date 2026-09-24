import {NextRequest} from "next/server";
import {withCapability} from "@/lib/api";
import {CAPABILITIES as C,hasCapability} from "@/lib/permission-catalog";
import {prisma} from "@/lib/prisma";
import {staffJson} from "@/lib/staff-area-auth";
import {londonDay,taskClosed,type QueueTask} from "@/lib/task-queue";
export async function GET(req:NextRequest){return withCapability(req,C.STAFF_TASKS,async user=>{
 const can=(c:typeof C[keyof typeof C])=>hasCapability(user.role,c,user.permissionOverrides);
 const monthStart=londonDay().slice(0,7)+"-01";
 const all=await prisma.operationalTask.findMany({include:{events:{orderBy:{createdAt:"asc"}}},orderBy:[{dueDate:"asc"},{id:"asc"}]});
 const permitted=all.filter(t=>t.sourceKey?.startsWith("medication:")?can(C.MEDICATION_VIEW):t.sourceKey?.startsWith("vehicle-unsafe:")?can(C.FLEET_VIEW):t.sourceKey?.startsWith("billing")?can(C.BILLING_REVIEW):can(C.STAFF_CALENDAR));
 const staffIds=permitted.flatMap(t=>t.assignedStaffId?[t.assignedStaffId]:[]);
 const staff=staffIds.length?await prisma.staffMember.findMany({where:{id:{in:staffIds}},select:{id:true,displayName:true,userId:true}}):[];
 const rows:QueueTask[]=permitted.map(t=>{
  const billing=!!t.sourceKey?.startsWith("billing"),medication=!!t.sourceKey?.startsWith("medication:"),fleet=!!t.sourceKey?.startsWith("vehicle-unsafe:");
  const assigned=staff.find(s=>s.id===t.assignedStaffId);
  return {id:t.id,source:"operational",title:t.title,category:billing?"Billing":medication?"Medication":fleet?"Fleet":"Operations",status:t.status,priority:t.priority,owner:assigned?.displayName||t.owner||"Unassigned",ownerId:assigned?.userId,description:t.notes,notes:t.notes,dueDate:t.dueDate.toISOString(),historical:billing&&t.endDate.toISOString().slice(0,10)<monthStart&&!taskClosed(t.status),reference:t.sourceKey||t.id,related:`${t.startDate.toISOString().slice(0,10)} – ${t.endDate.toISOString().slice(0,10)}`,events:t.events.map(e=>({id:e.id,action:e.action,createdAt:e.createdAt.toISOString()})),href:medication?"/dashboard/medications":fleet?"/dashboard/premises/fleet":billing?(t.billingRunId?`/dashboard/billing/runs/${t.billingRunId}`:"/dashboard/billing"):"/staff-portal/calendar"};
 });
 if(can(C.PREMISES_VIEW)){
  const actions=await prisma.premisesCorrectiveAction.findMany({include:{asset:{select:{name:true,documents:{where:{active:true},select:{title:true,documentUrl:true,reference:true}}}}},orderBy:[{dueDate:"asc"},{id:"asc"}]});
  const history=actions.length?await prisma.auditLog.findMany({where:{entityType:"PremisesCorrectiveAction",entityId:{in:actions.map(a=>a.id)}},select:{id:true,entityId:true,action:true,createdAt:true},orderBy:{createdAt:"asc"}}):[];
  rows.push(...actions.map(t=>({id:t.id,source:"premises" as const,title:t.title,category:"Compliance",status:t.status,priority:t.priority,owner:t.assignedTo||"Unassigned",dueDate:t.dueDate?.toISOString(),submittedAt:t.createdAt.toISOString(),description:t.notes,notes:t.notes,related:t.asset?.name,href:"/dashboard/premises?section=actions",evidence:t.asset?.documents.map(d=>({label:d.title+(d.reference?` · ${d.reference}`:""),href:d.documentUrl||undefined})),events:history.filter(e=>e.entityId===t.id).map(e=>({id:e.id,action:e.action,createdAt:e.createdAt.toISOString()}))})));
 }
 if(can(C.COMPLIANCE_ACTION_MANAGE)&&can(C.COMPLIANCE_VIEW)&&user.organisationId){
  const actions=await prisma.complianceAction.findMany({where:{organisationId:user.organisationId,...(!can(C.COMPLIANCE_SENSITIVE_VIEW)?{sourceId:null}:{})},include:{attachments:{select:{id:true,originalName:true}}},orderBy:[{dueDate:"asc"},{id:"asc"}]});
  const owners=await prisma.user.findMany({where:{organisationId:user.organisationId,id:{in:actions.flatMap(a=>a.assignedUserId?[a.assignedUserId]:[])}},select:{id:true,name:true}});
  rows.push(...actions.map(t=>({id:t.id,source:"compliance" as const,title:t.title,category:"Compliance",status:t.status,priority:t.priority,owner:owners.find(o=>o.id===t.assignedUserId)?.name||"Unassigned",ownerId:t.assignedUserId,dueDate:t.dueDate?.toISOString(),submittedAt:t.createdAt.toISOString(),description:t.description,notes:t.completionNotes,reference:t.reference,related:t.premisesLocation||undefined,awaitingEvidence:t.status==="AWAITING_EVIDENCE",decision:t.status==="AWAITING_VERIFICATION"&&(!t.assignedUserId||t.assignedUserId===user.id),evidence:t.attachments.map(a=>({label:a.originalName,href:`/api/compliance/attachments/${a.id}/file`}))})));
 }
 return staffJson({rows,count:rows.filter(t=>!taskClosed(t.status)&&!t.historical).length,historicalCount:rows.filter(t=>t.historical).length,userId:user.id,canCreate:can(C.STAFF_RESOURCES_MANAGE)&&can(C.STAFF_CALENDAR)});
})}
