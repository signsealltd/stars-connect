import type {User} from '@prisma/client';
import {prisma} from './prisma';
import {inspectionSchema} from './premises-input';
import type {z} from 'zod';
import {RequestError} from './request-error';
import {CAPABILITIES as C,hasCapability} from './permission-catalog';
export async function recordPremisesInspection(user:User,input:z.infer<typeof inspectionSchema>,id?:string){
 if(input.publicSummary!==undefined&&!hasCapability(user.role,C.PREMISES_MANAGE,user.permissionOverrides))throw new RequestError('Premises management permission is required to publish a summary.',403);
 if(input.result==='PASS'&&input.evidence?.answers.some(a=>a.result==='FAIL'))throw new RequestError('A failed checklist item cannot be recorded as a pass.',422);
 return prisma.$transaction(async tx=>{
 const asset=await tx.premisesAsset.findUnique({where:{id:input.assetId}});if(!asset)throw new RequestError('Asset unavailable.',404);
 const before=id?await tx.premisesInspection.findUnique({where:{id}}):null;if(id&&!before)throw new RequestError('Inspection unavailable.',404);
 if(before&&before.assetId!==asset.id)throw new RequestError('An inspection cannot be moved to a different asset.',422);
 const scheduleId=input.scheduleId===undefined?before?.scheduleId:input.scheduleId;
 const schedule=scheduleId?await tx.assetTestSchedule.findFirst({where:{id:scheduleId,assetId:asset.id,active:true}}):null;if(scheduleId&&!schedule)throw new RequestError('Select an active schedule for this asset.',422);
 const completedDate=new Date(input.completedDate),interval=schedule?schedule.recurrenceDays:asset.recurrenceDays;
 const nextDueDate=input.nextDueDate?new Date(input.nextDueDate):interval?new Date(completedDate.getTime()+interval*86400000):null;
 const data={assetId:asset.id,scheduleId:schedule?.id||null,testType:input.testType,completedDate,result:input.result,completedBy:input.completedBy,contractor:input.contractor||null,certificateReference:input.certificateReference||null,nextDueDate,notes:input.notes||null,...(input.publicSummary!==undefined?{publicSummary:input.publicSummary||null}:{}),...(input.evidence?{evidence:JSON.parse(JSON.stringify({...((before?.evidence||{}) as object),...input.evidence}))}:{})};
 const row=id?await tx.premisesInspection.update({where:{id},data}):await tx.premisesInspection.create({data:{...data,createdById:user.id}});
 const newer=await tx.premisesInspection.count({where:{assetId:asset.id,scheduleId:schedule?.id||null,completedDate:{gt:completedDate}}});
 if(!newer&&nextDueDate){if(schedule)await tx.assetTestSchedule.update({where:{id:schedule.id},data:{nextDueDate}});const earliest=await tx.assetTestSchedule.findFirst({where:{assetId:asset.id,active:true,nextDueDate:{not:null}},orderBy:{nextDueDate:'asc'}});await tx.premisesAsset.update({where:{id:asset.id},data:{nextDueDate:earliest?.nextDueDate||nextDueDate,updatedById:user.id}});}
 if(['FAIL','ACTION_REQUIRED'].includes(input.result)){
 if(!await tx.premisesCorrectiveAction.findFirst({where:{inspectionId:row.id,status:{notIn:['COMPLETED','ARCHIVED','CANCELLED']}}}))await tx.premisesCorrectiveAction.create({data:{assetId:asset.id,inspectionId:row.id,title:('Follow up: '+input.testType).slice(0,191),priority:input.result==='FAIL'?'CRITICAL':'HIGH',status:'AWAITING_EVIDENCE',verificationRequired:true,notes:input.notes||null,createdById:user.id,updatedById:user.id}});
 if(input.result==='FAIL'&&asset.status!=='DECOMMISSIONED')await tx.premisesAsset.update({where:{id:asset.id},data:{status:'OUT_OF_SERVICE',updatedById:user.id}});
 }
 await tx.auditLog.create({data:{action:id?'PREMISES_INSPECTION_UPDATED':'PREMISES_INSPECTION_RECORDED',actorType:'USER',actorId:user.id,entityType:'PremisesInspection',entityId:row.id,beforeValue:before?JSON.parse(JSON.stringify(before)):undefined,afterValue:JSON.parse(JSON.stringify(row))}});return row;
 },{isolationLevel:'Serializable'});
}
