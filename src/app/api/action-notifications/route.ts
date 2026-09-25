import {canReadSafetyTask} from "@/lib/safety-reminders";
import {taskClosed} from "@/lib/task-queue";
import {NextRequest} from "next/server";
import {withCapability} from "@/lib/api";
import {CAPABILITIES as C,hasCapability} from "@/lib/permission-catalog";
import {prisma} from "@/lib/prisma";
import {staffJson} from "@/lib/staff-area-auth";
import {medicationEstimate,terminalMedicationStates} from "@/lib/medication";
import {canReviewStaffRequest} from "@/lib/staff-task-access";
export async function GET(req:NextRequest){return withCapability(req,C.DASHBOARD_VIEW,async user=>{
 const can=(cap:typeof C[keyof typeof C])=>hasCapability(user.role,cap,user.permissionOverrides);
 const medicines=can(C.MEDICATION_VIEW)?await prisma.clientMedication.findMany():[];
 const alerts=medicines.map(m=>({id:m.id,...medicationEstimate(m)}));
 const events=await prisma.complianceNotificationEvent.findMany({where:{organisationId:user.organisationId!,recipientId:user.id,recordType:"TASK_UPDATE",status:"PENDING"},orderBy:{createdAt:"desc"},take:100});
 const notifications=[];for(const e of events){if(e.eventType.startsWith("PROFILE")){const r=await prisma.staffRequest.findUnique({where:{id:e.recordId}});if(r&&can(C.STAFF_TASKS)&&canReviewStaffRequest(user,r))notifications.push({id:e.id,title:"Staff profile update awaiting review",href:"/dashboard/staff/tasks",date:e.createdAt})}else if(e.eventType==="SAFETY_REMINDER"&&can(C.STAFF_TASKS)){const t=await prisma.operationalTask.findUnique({where:{id:e.recordId}});if(t&&!taskClosed(t.status)&&canReadSafetyTask(user,t.details))notifications.push({id:e.id,title:t.title,href:"/dashboard/staff/tasks?task="+t.id,date:e.createdAt})}else if(can(C.MEDICATION_VIEW)){const t=await prisma.operationalTask.findUnique({where:{id:e.recordId}});if(t&&!terminalMedicationStates.has(t.status))notifications.push({id:e.id,title:e.eventType.toLowerCase().replaceAll("_"," "),href:"/dashboard/medications",date:e.createdAt})}}
 return staffJson({medications:can(C.MEDICATION_VIEW)?{due:alerts.filter(a=>a.priority!=="NONE").length,urgent:alerts.filter(a=>["CRITICAL","OVERDUE","URGENT"].includes(a.priority)).length,unconfirmed:alerts.filter(a=>!a.runOut||a.confirmationOverdue).length}:null,notifications});
})}
export async function POST(req:NextRequest){return withCapability(req,C.DASHBOARD_VIEW,async user=>{const {id}=await req.json();if(typeof id!=="string")return staffJson({error:"Choose a notification."},422);await prisma.complianceNotificationEvent.updateMany({where:{id,recipientId:user.id,organisationId:user.organisationId!,recordType:"TASK_UPDATE"},data:{status:"READ",deliveredAt:new Date()}});return staffJson({ok:true})})}
