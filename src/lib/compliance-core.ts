import type { ComplianceWorkflowStatus } from "@prisma/client";

export const SAFETY_DRAFT_NOTICE = "AI-generated or template safety content is a drafting aid only. It must be checked, amended where necessary and approved by an authorised manager or competent person before use.";

export function riskScore(likelihood: number, severity: number, size = 5) {
  if (!Number.isInteger(likelihood) || !Number.isInteger(severity) || likelihood < 1 || severity < 1 || likelihood > size || severity > size) throw new Error("RISK_VALUE_OUT_OF_RANGE");
  return likelihood * severity;
}
const transitions: Record<ComplianceWorkflowStatus, readonly ComplianceWorkflowStatus[]> = {
  DRAFT:["UNDER_REVIEW","ARCHIVED"], UNDER_REVIEW:["AWAITING_APPROVAL","DRAFT","ARCHIVED"], AWAITING_APPROVAL:["APPROVED","DRAFT"],
  APPROVED:["PUBLISHED","DRAFT"], PUBLISHED:["SUPERSEDED"], SUPERSEDED:["ARCHIVED"], ARCHIVED:[],
};
export const canTransition=(from:ComplianceWorkflowStatus,to:ComplianceWorkflowStatus)=>transitions[from].includes(to);
export function assertTransition(from:ComplianceWorkflowStatus,to:ComplianceWorkflowStatus){if(!canTransition(from,to))throw new Error("INVALID_COMPLIANCE_TRANSITION");}
export const isOverdue=(dueDate:Date|null|undefined,status:string,now=new Date())=>Boolean(dueDate&&dueDate.getTime()<now.getTime()&&!["COMPLETED","CANCELLED"].includes(status));
export const notificationKey=(i:{organisationId:string;eventType:string;recordId:string;versionId?:string;recipientId?:string;threshold?:number})=>[i.organisationId,i.eventType,i.recordId,i.versionId??"-",i.recipientId??"-",i.threshold??"-"].join(":");

export function organisationScope<T extends object>(organisationId: string, where: T) {
  if (!organisationId.trim()) throw new Error("ORGANISATION_REQUIRED");
  return { ...where, organisationId };
}
