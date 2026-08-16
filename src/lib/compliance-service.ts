import { Prisma, type ComplianceWorkflowStatus, type User } from "@prisma/client";
import { prisma } from "./prisma";
import { assertTransition, riskScore } from "./compliance-core";
import type { z } from "zod";
import type { ramsDraftInput } from "./compliance-input";

export function requireOrganisation(user: User) {
  if (!user.organisationId) throw Object.assign(new Error("ORGANISATION_REQUIRED"), { status: 403 });
  return user.organisationId;
}
const dateValue=(value:unknown)=>typeof value==="string"&&value?new Date(value+"T00:00:00.000Z"):null;

export async function createRiskAssessment(user:User,input:Record<string,unknown>){
  const organisationId=requireOrganisation(user),hazards=(input.hazards??[]) as Array<Record<string,unknown>>;
  return prisma.$transaction(async tx=>{
    const record=await tx.complianceRecord.create({data:{organisationId,recordType:"RISK_ASSESSMENT",reference:String(input.reference),createdById:user.id}});
    const version=await tx.complianceRecordVersion.create({data:{organisationId,recordId:record.id,version:1,title:String(input.title),categoryId:input.categoryId as string|null|undefined,description:input.description as string|null|undefined,scope:input.scope as string|null|undefined,premisesLocation:input.premisesLocation as string|null|undefined,relatedActivity:input.relatedActivity as string|null|undefined,relatedAssetId:input.relatedAssetId as string|null|undefined,assessorId:input.assessorId as string|null|undefined,responsibleManagerId:input.responsibleManagerId as string|null|undefined,assessmentDate:dateValue(input.assessmentDate),reviewDate:dateValue(input.reviewDate),internalNotes:input.internalNotes as string|null|undefined,revisionNotes:input.revisionNotes as string|null|undefined,tags:(input.tags??[]) as Prisma.InputJsonValue,createdById:user.id,hazards:{create:hazards.map(h=>({sortOrder:Number(h.sortOrder??0),hazard:String(h.hazard),whoMayBeHarmed:String(h.whoMayBeHarmed),howTheyMayBeHarmed:String(h.howTheyMayBeHarmed),existingControls:String(h.existingControls),initialLikelihood:Number(h.initialLikelihood),initialSeverity:Number(h.initialSeverity),initialRiskScore:riskScore(Number(h.initialLikelihood),Number(h.initialSeverity)),furtherControls:h.furtherControls as string|null|undefined,actionOwnerId:h.actionOwnerId as string|null|undefined,targetDate:dateValue(h.targetDate),residualLikelihood:Number(h.residualLikelihood),residualSeverity:Number(h.residualSeverity),residualRiskScore:riskScore(Number(h.residualLikelihood),Number(h.residualSeverity))}))}},include:{hazards:true}});
    await tx.auditLog.create({data:{action:"COMPLIANCE_RECORD_CREATED",actorType:"USER",actorId:user.id,entityType:"ComplianceRecord",entityId:record.id,afterValue:{organisationId,type:"RISK_ASSESSMENT",version:1,status:"DRAFT"}}});
    return{record,version};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function transitionVersion(input:{user:User;recordId:string;to:ComplianceWorkflowStatus;comments?:string}){
  const organisationId=requireOrganisation(input.user);
  return prisma.$transaction(async tx=>{
    const record=await tx.complianceRecord.findFirst({where:{id:input.recordId,organisationId,archivedAt:null},include:{versions:{orderBy:{version:"desc"},take:1}}}),version=record?.versions[0];
    if(!record||!version)throw Object.assign(new Error("NOT_FOUND"),{status:404});
    assertTransition(version.status,input.to);const now=new Date(),data:Prisma.ComplianceRecordVersionUpdateInput={status:input.to};
    if(input.to==="UNDER_REVIEW")data.submittedAt=now;
    if(input.to==="APPROVED"){data.approvedAt=now;data.approvedById=input.user.id;}
    if(input.to==="PUBLISHED"){data.publishedAt=now;data.publishedById=input.user.id;}
    const updated=await tx.complianceRecordVersion.update({where:{id:version.id},data});
    if(input.to==="APPROVED")await tx.complianceApproval.create({data:{versionId:version.id,decision:"APPROVED",actorId:input.user.id,comments:input.comments}});
    if(input.to==="DRAFT"&&version.status==="AWAITING_APPROVAL")await tx.complianceApproval.create({data:{versionId:version.id,decision:"REJECTED",actorId:input.user.id,comments:input.comments}});
    if(input.to==="PUBLISHED"){await tx.complianceRecordVersion.updateMany({where:{recordId:record.id,id:{not:version.id},status:"PUBLISHED"},data:{status:"SUPERSEDED"}});await tx.complianceRecord.update({where:{id:record.id},data:{publishedVersionNumber:version.version}});}
    await tx.auditLog.create({data:{action:"COMPLIANCE_STATUS_CHANGED",actorType:"USER",actorId:input.user.id,entityType:"ComplianceRecord",entityId:record.id,beforeValue:{status:version.status,version:version.version},afterValue:{status:input.to,version:version.version,organisationId}}});
    return updated;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function acknowledgeVersion(user:User,versionId:string,context:{ipAddress?:string;userAgent?:string;deviceId?:string}={}){
  const organisationId=requireOrganisation(user);
  return prisma.$transaction(async tx=>{
    const version=await tx.complianceRecordVersion.findFirst({where:{id:versionId,organisationId,status:"PUBLISHED"}});
    if(!version)throw Object.assign(new Error("PUBLISHED_VERSION_NOT_FOUND"),{status:404});
    const acknowledgement=await tx.complianceAcknowledgement.create({data:{organisationId,versionId,userId:user.id,...context}});
    await tx.auditLog.create({data:{action:"COMPLIANCE_VERSION_ACKNOWLEDGED",actorType:"USER",actorId:user.id,entityType:"ComplianceRecordVersion",entityId:versionId,afterValue:{organisationId,version:version.version}}});
    return acknowledgement;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

type RamsDraft=z.infer<typeof ramsDraftInput>;
const ramsContent=(input:RamsDraft)=>({activityDescription:input.activityDescription,responsiblePerson:input.responsiblePerson,assessmentAuthor:input.assessmentAuthor,operationOccurrenceId:input.operationOccurrenceId??null,operationTitle:input.operationTitle??null,students:input.students,staff:input.staff,ppe:input.ppe,equipment:input.equipment,emergencyArrangements:input.emergencyArrangements,methodStatement:input.methodStatement,additionalNotes:input.additionalNotes});
const hazardData=(hazards:RamsDraft["hazards"])=>hazards.map((h,index)=>({sortOrder:index,hazard:h.hazard,whoMayBeHarmed:h.whoMayBeHarmed,howTheyMayBeHarmed:h.howTheyMayBeHarmed,existingControls:h.existingControls,initialLikelihood:h.initialLikelihood,initialSeverity:h.initialSeverity,initialRiskScore:riskScore(h.initialLikelihood,h.initialSeverity),furtherControls:h.furtherControls,actionOwnerId:h.actionOwnerId,targetDate:dateValue(h.targetDate),residualLikelihood:h.residualLikelihood,residualSeverity:h.residualSeverity,residualRiskScore:riskScore(h.residualLikelihood,h.residualSeverity)}));
const methodData=(steps:RamsDraft["methodSteps"])=>steps.map((step,index)=>({...step,stepNumber:index+1}));
const checklistData=(items:RamsDraft["checklistItems"])=>items.map((item,index)=>({...item,sortOrder:index}));

export async function createRams(user:User,input:RamsDraft){const organisationId=requireOrganisation(user);return prisma.$transaction(async tx=>{const record=await tx.complianceRecord.create({data:{organisationId,recordType:"RAMS",reference:input.reference,createdById:user.id}});const version=await tx.complianceRecordVersion.create({data:{organisationId,recordId:record.id,version:1,title:input.title,description:input.activityDescription,scope:input.activityDescription,premisesLocation:input.location,relatedActivity:input.operationTitle,assessorId:user.id,responsibleManagerId:user.id,assessmentDate:dateValue(input.assessmentDate),reviewDate:dateValue(input.reviewDate),overallResidualRisk:Math.max(0,...input.hazards.map(h=>riskScore(h.residualLikelihood,h.residualSeverity))),structuredContent:ramsContent(input) as Prisma.InputJsonValue,createdById:user.id,hazards:{create:hazardData(input.hazards)},methodSteps:{create:methodData(input.methodSteps)},checklistItems:{create:checklistData(input.checklistItems)}}});await tx.auditLog.create({data:{action:"RAMS_DRAFT_CREATED",actorType:"USER",actorId:user.id,entityType:"ComplianceRecord",entityId:record.id,afterValue:{organisationId,reference:input.reference,version:1}}});return{record,version};},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}

export async function updateRamsDraft(user:User,recordId:string,input:RamsDraft){const organisationId=requireOrganisation(user);return prisma.$transaction(async tx=>{const record=await tx.complianceRecord.findFirst({where:{id:recordId,organisationId,recordType:"RAMS",archivedAt:null},include:{versions:{orderBy:{version:"desc"},take:1}}}),version=record?.versions[0];if(!record||!version)throw Object.assign(new Error("NOT_FOUND"),{status:404});if(!["DRAFT","UNDER_REVIEW"].includes(version.status))throw Object.assign(new Error("IMMUTABLE_VERSION"),{status:409});if(input.reference!==record.reference)await tx.complianceRecord.update({where:{id:record.id},data:{reference:input.reference}});await tx.riskAssessmentHazard.deleteMany({where:{versionId:version.id}});await tx.ramsMethodStep.deleteMany({where:{versionId:version.id}});await tx.ramsChecklistItem.deleteMany({where:{versionId:version.id}});const updated=await tx.complianceRecordVersion.update({where:{id:version.id},data:{title:input.title,description:input.activityDescription,scope:input.activityDescription,premisesLocation:input.location,relatedActivity:input.operationTitle,assessmentDate:dateValue(input.assessmentDate),reviewDate:dateValue(input.reviewDate),overallResidualRisk:Math.max(0,...input.hazards.map(h=>riskScore(h.residualLikelihood,h.residualSeverity))),structuredContent:ramsContent(input) as Prisma.InputJsonValue,hazards:{create:hazardData(input.hazards)},methodSteps:{create:methodData(input.methodSteps)},checklistItems:{create:checklistData(input.checklistItems)}}});await tx.auditLog.create({data:{action:"RAMS_DRAFT_UPDATED",actorType:"USER",actorId:user.id,entityType:"ComplianceRecord",entityId:record.id,afterValue:{organisationId,version:version.version}}});return updated;},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}

export async function createRamsRevision(user:User,recordId:string){const organisationId=requireOrganisation(user);return prisma.$transaction(async tx=>{const record=await tx.complianceRecord.findFirst({where:{id:recordId,organisationId,recordType:"RAMS",archivedAt:null},include:{versions:{orderBy:{version:"desc"},take:1,include:{hazards:true,methodSteps:true,checklistItems:true}}}}),source=record?.versions[0];if(!record||!source)throw Object.assign(new Error("NOT_FOUND"),{status:404});if(!["APPROVED","PUBLISHED","SUPERSEDED"].includes(source.status))throw Object.assign(new Error("REVISION_NOT_ALLOWED"),{status:409});const version=await tx.complianceRecordVersion.create({data:{organisationId,recordId:record.id,version:source.version+1,status:"DRAFT",title:source.title,categoryId:source.categoryId,description:source.description,scope:source.scope,premisesLocation:source.premisesLocation,relatedActivity:source.relatedActivity,assessorId:user.id,responsibleManagerId:source.responsibleManagerId,assessmentDate:new Date(),reviewDate:source.reviewDate,overallResidualRisk:source.overallResidualRisk,structuredContent:source.structuredContent===null?undefined:source.structuredContent as Prisma.InputJsonValue,revisionNotes:`Revision of version ${source.version}`,supersedesVersionId:source.id,createdById:user.id,hazards:{create:source.hazards.map(({id,versionId,createdAt,updatedAt,...h})=>h)},methodSteps:{create:source.methodSteps.map(({id,versionId,createdAt,updatedAt,...s})=>s)},checklistItems:{create:source.checklistItems.map(({id,versionId,completedById,completedAt,...c})=>({...c,completed:false}))}}});await tx.auditLog.create({data:{action:"RAMS_REVISION_CREATED",actorType:"USER",actorId:user.id,entityType:"ComplianceRecord",entityId:record.id,afterValue:{organisationId,version:version.version,sourceVersion:source.version}}});return version;},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
