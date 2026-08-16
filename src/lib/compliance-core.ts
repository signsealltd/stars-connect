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

export type RamsReadinessInput={title?:string;activityDescription?:string;location?:string;responsiblePerson?:string;assessmentAuthor?:string;assessmentDate?:string;reviewDate?:string;hazards?:Array<{hazard?:string;whoMayBeHarmed?:string;existingControls?:string;residualLikelihood?:number;residualSeverity?:number}>;methodSteps?:Array<{stage?:string;method?:string}>;checklistItems?:Array<{required?:boolean;completed?:boolean}>};
export function ramsReadiness(input:RamsReadinessInput){const issues:string[]=[];if(!input.title?.trim())issues.push("Add a title.");if(!input.activityDescription?.trim())issues.push("Describe the activity or task.");if(!input.location?.trim())issues.push("Add a location.");if(!input.responsiblePerson?.trim())issues.push("Name the responsible person.");if(!input.assessmentAuthor?.trim())issues.push("Name the assessment author.");if(!input.assessmentDate)issues.push("Add an assessment date.");if(!input.reviewDate)issues.push("Add a review date.");if(!input.hazards?.length)issues.push("Add at least one hazard.");for(const [i,h] of (input.hazards??[]).entries()){if(!h.hazard?.trim()||!h.whoMayBeHarmed?.trim()||!h.existingControls?.trim())issues.push(`Complete hazard ${i+1}.`);if(!h.residualLikelihood||!h.residualSeverity)issues.push(`Score the residual risk for hazard ${i+1}.`);}if(!input.methodSteps?.length)issues.push("Add at least one method step.");if((input.checklistItems??[]).some(item=>item.required&&!item.completed))issues.push("Complete all required readiness checks.");return{ready:issues.length===0,issues};}
