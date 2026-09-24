import {formatInTimeZone} from "date-fns-tz";
export type QueueTask={id:string;source:"request"|"operational"|"premises"|"compliance"|"confirmation";title:string;canChange?:boolean;category:string;status:string;priority:string;owner:string;ownerId?:string|null;dueDate?:string|null;submittedAt?:string|null;description?:string|null;href?:string;historical?:boolean;decision?:boolean;awaitingEvidence?:boolean;notes?:string|null;reference?:string;related?:string;events?:{id:string;action:string;createdAt:string;message?:string}[];evidence?:{label:string;href?:string}[]};
export type RequestRow={id:string;type:string;status:string;createdAt:string;dueDate?:string;assignedUserId?:string;staff:{displayName:string};details:Record<string,unknown>;events:{id:string;action:string;message:string;createdAt?:string}[];documents:{id:string;filename:string}[]};
export const taskClosed=(status:string)=>["ARCHIVED","CONFIRMED","REVIEWED","COMPLETED","CLOSED","CANCELLED","DECLINED","APPROVED","NO_LONGER_REQUIRED","ESTIMATE_CORRECTED","VERIFIED"].includes(status);
export const readable=(value:string)=>value.toLowerCase().replaceAll("_"," ").replace(/^./,c=>c.toUpperCase());
export const londonDay=(now=new Date())=>formatInTimeZone(now,"Europe/London","yyyy-MM-dd");
export function requestSubject(r:RequestRow){
 const d=r.details;
 if(r.type==="CONCERN")return `Confidential concern · ${r.id.slice(0,8)}`;
 if(r.type==="PROFILE")return `${d.description?String(d.description):d.hr?"Staff profile change proposed":"Profile update requested"} — ${r.staff.displayName}`;
 return `${r.type==="LEAVE"?"Leave request":r.type==="SICKNESS"?"Sickness report":readable(r.type)} — ${r.staff.displayName}`;
}
export function requestTask(r:RequestRow,reviewers:{id:string;name:string}[],userId:string):QueueTask{
 const closed=taskClosed(r.status);
 return {id:r.id,source:"request",title:requestSubject(r),category:"Staff requests",status:r.status,priority:r.details.immediateRisk?"URGENT":"NORMAL",owner:reviewers.find(u=>u.id===r.assignedUserId)?.name||(r.assignedUserId?"Assigned reviewer":"Unassigned"),ownerId:r.assignedUserId,dueDate:r.dueDate,submittedAt:r.createdAt,description:r.type==="CONCERN"?"Restricted case. Open to review the authorised details.":[r.details.category&&readable(String(r.details.category)),r.details.startDate&&`${r.details.startDate} – ${r.details.endDate||r.details.startDate}`,r.type==="PROFILE"&&(closed?"Recorded update · no decision required":"Proposed change awaiting a decision")].filter(Boolean).join(" · "),decision:!closed&&["NEW","IN_REVIEW","CANCELLATION_REQUESTED"].includes(r.status)&&(!r.assignedUserId||r.assignedUserId===userId),awaitingEvidence:r.status==="AWAITING_EVIDENCE",reference:r.id};
}
export const taskDueDay=(task:QueueTask)=>task.dueDate?londonDay(new Date(task.dueDate)):undefined;
export function taskTiming(task:QueueTask,today=londonDay()){
 const date=taskDueDay(task),closed=taskClosed(task.status);
 const end=new Date(today+"T12:00:00Z");end.setUTCDate(end.getUTCDate()+7-(end.getUTCDay()||7));
 return {overdue:!closed&&!!date&&date<today,thisWeek:!closed&&!!date&&date>=today&&date<=end.toISOString().slice(0,10),soon:!closed&&!!date&&date>=today&&date<=new Date(Date.parse(today+"T12:00:00Z")+7*86400000).toISOString().slice(0,10)};
}
export function taskStatus(task:QueueTask,today=londonDay()){
 if(taskClosed(task.status))return {label:readable(task.status),tone:"done"};
 if(taskTiming(task,today).overdue)return {label:"Overdue",tone:"overdue"};
 if(task.awaitingEvidence||task.status==="AWAITING_EVIDENCE")return {label:"Awaiting evidence",tone:"evidence"};
 if(task.status==="PENDING"&&task.source==="confirmation")return {label:"Awaiting staff confirmation",tone:"neutral"};
 if(task.status==="WAITING")return {label:"Awaiting information",tone:"evidence"};
 if(task.status==="BLOCKED")return {label:"Blocked",tone:"blocked"};
 if(task.decision||["AWAITING_APPROVAL","AWAITING_VERIFICATION"].includes(task.status))return {label:"Awaiting review",tone:"review"};
 if(taskTiming(task,today).soon)return {label:"Due soon",tone:"soon"};
 return {label:readable(task.status),tone:"neutral"};
}
export function sortTasks(rows:QueueTask[],today=londonDay()){
 const rank=(r:QueueTask)=>taskClosed(r.status)?9:r.historical?8:r.priority==="URGENT"||r.priority==="CRITICAL"?0:taskTiming(r,today).overdue?1:r.decision?2:r.priority==="HIGH"?3:4;
 return [...rows].sort((a,b)=>rank(a)-rank(b)||(a.dueDate||"9999").localeCompare(b.dueDate||"9999")||(b.submittedAt||"").localeCompare(a.submittedAt||"")||a.source.localeCompare(b.source)||a.id.localeCompare(b.id));
}
export function queueCounts(rows:QueueTask[],today=londonDay()){
 const active=rows.filter(r=>!taskClosed(r.status));
 return {decision:active.filter(r=>r.decision).length,week:active.filter(r=>taskTiming(r,today).thisWeek).length,overdue:active.filter(r=>taskTiming(r,today).overdue).length,evidence:active.filter(r=>r.awaitingEvidence||r.status==="AWAITING_EVIDENCE").length};
}
