import {resourceCategories} from "./staff-resources";
import {prisma} from "./prisma";
import {plannedStaffShifts} from "./staff-planning";
import {staffDateRange} from "./staff-area-input";
import type {StaffIdentity} from "./staff-area-auth";
import {CAPABILITIES,hasCapability} from "./permission-catalog";
export async function personalSchedule(staffId:string,organisationId:string,month:string){
 const {start,end}=staffDateRange(month);
 const [patterns,stored,absences,assignments]=await Promise.all([
  prisma.staffWorkingPattern.findMany({where:{staffId,organisationId,active:true,effectiveStart:{lt:end},OR:[{effectiveEnd:null},{effectiveEnd:{gte:start}}]},include:{intervals:true,staff:{select:{displayName:true,startDate:true,endDate:true}}}}),
  prisma.staffScheduleOccurrence.findMany({where:{staffId,organisationId,date:{gte:start,lt:end}},include:{staff:{select:{displayName:true,startDate:true,endDate:true}}}}),
  prisma.staffScheduleException.findMany({where:{staffId,organisationId,approvalStatus:"APPROVED",startDate:{lt:end},endDate:{gte:start},type:{in:["ANNUAL_LEAVE","SICKNESS","UNPAID_LEAVE","NON_WORKING_DAY"]}},select:{id:true,staffId:true,startDate:true,endDate:true,startTime:true,endTime:true,type:true}}),
  prisma.operationStaffAssignment.findMany({where:{staffId,organisationId,status:"ASSIGNED",occurrence:{startAt:{gte:start,lt:end},status:{not:"DRAFT"}}},include:{occurrence:{include:{operation:{select:{title:true,type:true}}}}}}),
 ]);
 const shifts=plannedStaffShifts(patterns,stored,absences,start,new Date(+end-1));
 return [...shifts.map(s=>({id:s.generationKey,title:"Scheduled shift",kind:"SHIFT",start:s.startAt.toISOString(),end:s.endAt.toISOString(),location:s.premisesName||"STARS Day Service",status:"Confirmed",notes:"",required:false,confirmation:""})),
 ...absences.map(a=>({id:a.id,title:a.type==="SICKNESS"?"Sickness absence":"Approved leave",kind:a.type==="SICKNESS"?"SICKNESS":"LEAVE",start:a.startDate.toISOString().slice(0,10)+(a.startTime?"T"+a.startTime+":00Z":"T00:00:00Z"),end:a.endDate.toISOString(),location:"",status:"Recorded",notes:"",required:false,confirmation:""})),
 ...assignments.map(a=>({id:a.id,title:a.occurrence.operation.title,kind:a.occurrence.operation.type.toUpperCase().includes("TRAINING")?"TRAINING":a.occurrence.operation.type==="ADDITIONAL_SHIFT"?"SHIFT":"EVENT",start:a.occurrence.startAt.toISOString(),end:a.occurrence.endAt.toISOString(),location:a.occurrence.location||a.occurrence.premisesName||"",status:a.occurrence.status==="CANCELLED"?"Cancelled":"Confirmed",notes:a.occurrence.staffVisibleNotes||"",required:a.occurrence.staffConfirmationRequired,confirmation:a.confirmation}))].sort((a,b)=>a.start.localeCompare(b.start));
}
export async function personalData(i:StaffIdentity,month:string){
 const capabilities=Object.values(CAPABILITIES).filter(c=>hasCapability(i.user.role,c,i.user.permissionOverrides));const canCalendar=capabilities.includes(CAPABILITIES.STAFF_CALENDAR),canTraining=capabilities.includes(CAPABILITIES.STAFF_TRAINING);
 const [schedule,requests,training,notifications,passkeys,policies,receipts,directory,documents]=await Promise.all([
  canCalendar?personalSchedule(i.staff.id,i.user.organisationId!,month):Promise.resolve([]),
  prisma.staffRequest.findMany({where:{staffId:i.staff.id,organisationId:i.user.organisationId!},include:{events:{where:{staffVisible:true},select:{id:true,action:true,message:true,createdAt:true},orderBy:{createdAt:"asc"}},documents:{where:{expiresAt:{gt:new Date()}},select:{id:true,filename:true}}},orderBy:{createdAt:"desc"},take:100}),
  canTraining?prisma.staffTrainingRecord.findMany({where:{staffId:i.staff.id,active:true},select:{id:true,courseName:true,provider:true,completedDate:true,expiryDate:true,mandatory:true,certificateReference:true}}):Promise.resolve([]),
  prisma.staffPortalNotification.findMany({where:{staffId:i.staff.id},orderBy:{createdAt:"desc"},take:30}),
  prisma.staffPasskey.findMany({where:{accountId:i.staff.id},select:{id:true,name:true,createdAt:true}}),
  prisma.staffResource.findMany({where:{status:"PUBLISHED",category:{in:Object.entries(resourceCategories).filter(([,cap])=>hasCapability(i.user.role,cap,i.user.permissionOverrides)).map(([category])=>category)},studentId:null},select:{id:true,title:true,version:true,content:true,documentId:true,category:true}}),
 prisma.staffResourceReceipt.findMany({where:{userId:i.user.id},select:{resourceId:true,agreedAt:true,readAt:true}}),
 prisma.user.findMany({where:{organisationId:i.user.organisationId!,active:true},select:{id:true,name:true}}),
 prisma.staffPrivateDocument.findMany({where:{staffId:i.staff.id,expiresAt:{gt:new Date()},trainingRecordId:{not:null}},select:{id:true,filename:true,trainingRecordId:true}}),
 ]);
 let nextShift=schedule.find(s=>s.kind==="SHIFT"&&s.status!=="Cancelled"&&new Date(s.end)>new Date());
 if(!nextShift&&canCalendar){const nextMonth=new Date();nextMonth.setUTCMonth(nextMonth.getUTCMonth()+1,1);const upcoming=await personalSchedule(i.staff.id,i.user.organisationId!,nextMonth.toISOString().slice(0,7));nextShift=upcoming.find(s=>s.kind==="SHIFT"&&s.status!=="Cancelled"&&new Date(s.end)>new Date());}
 return {capabilities,nextShift,directory,documents,staff:{id:i.staff.id,name:i.staff.displayName,legalName:i.staff.firstName+" "+i.staff.lastName,email:i.staff.email,phone:i.staff.phone,jobRole:i.staff.jobRole,startDate:i.staff.startDate,hours:i.staff.contractedWeeklyHours,profile:i.account.profile,preferences:i.account.preferences},schedule,requests:requests.map(({involvedUserIds,assignedUserId,...r})=>{void involvedUserIds;void assignedUserId;return r}),training,notifications,passkeys,policies:policies.map(p=>({...p,receipt:receipts.find(r=>r.resourceId===p.id)}))};
}
