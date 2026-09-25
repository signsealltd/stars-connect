import type {User} from "@prisma/client";
import {CAPABILITIES as C,hasCapability} from "./permission-catalog";
import {RequestError} from "./request-error";
export type TaskSource="operational"|"premises"|"compliance";
export type TaskAction="complete"|"archive"|"reopen";
export function canChangeTask(user:Pick<User,"role"|"permissionOverrides">,source:TaskSource,sourceKey?:string|null){
 if(source==="operational"&&(sourceKey?.startsWith("safety:")||sourceKey?.startsWith("medication:")||sourceKey?.startsWith("vehicle-unsafe:")))return false;
 const capability=source==="premises"?C.PREMISES_MANAGE:source==="compliance"?C.COMPLIANCE_ACTION_MANAGE:sourceKey?.startsWith("billing")?C.BILLING_EDIT:C.STAFF_RESOURCES_MANAGE;
 const view=source==="premises"?C.PREMISES_VIEW:source==="compliance"?C.COMPLIANCE_VIEW:sourceKey?.startsWith("billing")?C.BILLING_REVIEW:C.STAFF_CALENDAR;
 return hasCapability(user.role,capability,user.permissionOverrides)&&hasCapability(user.role,view,user.permissionOverrides);
}
export function nextTaskStatus(source:TaskSource,action:TaskAction,task:{status:string;verificationRequired?:boolean;completedById?:string|null;attachmentCount?:number},actorId:string){
 if(action==="archive"&&["ARCHIVED","CANCELLED"].includes(task.status))throw new RequestError("This task is already deleted.",409);
 if(action==="reopen"&&!["COMPLETED","ARCHIVED","CANCELLED"].includes(task.status))throw new RequestError("Only closed tasks can be reopened.",409);
 if(action==="archive")return source==="compliance"?"CANCELLED":"ARCHIVED";
 if(action==="reopen")return "OPEN";
 if(["ARCHIVED","CANCELLED"].includes(task.status))throw new RequestError("Restore this task before marking it complete.",409);
 if(source==="compliance"||source==="premises"){
  if((task.status==="AWAITING_EVIDENCE"||task.verificationRequired)&&!task.attachmentCount)throw new RequestError("Add the required evidence before completing this task.",409);
  if(task.verificationRequired){
   if(task.status!=="AWAITING_VERIFICATION")return "AWAITING_VERIFICATION";
   if(task.completedById===actorId)throw new RequestError("A different authorised person must verify this task.",409);
  }
 }
 return "COMPLETED";
}
