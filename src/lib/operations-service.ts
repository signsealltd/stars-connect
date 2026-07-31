import { Prisma, type OperationStatus, type User } from "@prisma/client";
import { addDays } from "date-fns";
import { prisma } from "./prisma";
import { requireOrganisation } from "./compliance-service";
import { assertOperationTransition, calculateReadiness, generatePatternOccurrences, reconcileAttendance, expandRecurrence } from "./operations-core";

const dbDate=(value:string)=>new Date(value+"T00:00:00.000Z");
const serial={isolationLevel:Prisma.TransactionIsolationLevel.Serializable} as const;

export async function createWorkingPattern(user:User,staffId:string,input:{name:string;effectiveStart:string;effectiveEnd?:string;timezone?:string;cycleWeeks:number;notes?:string;intervals:Array<{weekIndex:number;dayOfWeek:number;startTime:string;endTime:string;breakMinutes?:number;premisesName?:string;defaultRole?:string}>}){
 const organisationId=requireOrganisation(user);
 return prisma.$transaction(async tx=>{
  const staff=await tx.staffMember.findFirst({where:{id:staffId,archivedAt:null}});
  if(!staff)throw Object.assign(new Error("STAFF_NOT_FOUND"),{status:404});
  const latest=await tx.staffWorkingPattern.findFirst({where:{organisationId,staffId},orderBy:{version:"desc"}});
  const pattern=await tx.staffWorkingPattern.create({data:{organisationId,staffId,name:input.name,effectiveStart:dbDate(input.effectiveStart),effectiveEnd:input.effectiveEnd?dbDate(input.effectiveEnd):null,timezone:input.timezone??"Europe/London",cycleWeeks:input.cycleWeeks,notes:input.notes,version:(latest?.version??0)+1,createdById:user.id,intervals:{create:input.intervals}},include:{intervals:true}});
  const generationStart=pattern.effectiveStart>new Date()?pattern.effectiveStart:new Date();
  const generated=generatePatternOccurrences({patternId:pattern.id,effectiveStart:pattern.effectiveStart,effectiveEnd:pattern.effectiveEnd,rangeStart:generationStart,rangeEnd:addDays(generationStart,90),timezone:pattern.timezone,cycleWeeks:pattern.cycleWeeks,intervals:pattern.intervals});
  for(const shift of generated){
   const occurrence=await tx.staffScheduleOccurrence.upsert({where:{generationKey:shift.generationKey},update:{},create:{organisationId,staffId,patternId:pattern.id,patternIntervalId:shift.intervalId,date:shift.date,startAt:shift.startAt,endAt:shift.endAt,expectedClockInFrom:shift.expectedClockInFrom,expectedClockInUntil:shift.expectedClockInUntil,expectedClockOutFrom:shift.expectedClockOutFrom,expectedClockOutUntil:shift.expectedClockOutUntil,premisesName:shift.premisesName,role:shift.role,generationKey:shift.generationKey}});
   await tx.expectedStaffAttendance.upsert({where:{scheduleOccurrenceId:occurrence.id},update:{expectedStartAt:occurrence.startAt,expectedEndAt:occurrence.endAt},create:{organisationId,staffId,scheduleOccurrenceId:occurrence.id,date:occurrence.date,expectedStartAt:occurrence.startAt,expectedEndAt:occurrence.endAt}});
  }
  await tx.auditLog.create({data:{action:"STAFF_WORKING_PATTERN_CREATED",actorType:"USER",actorId:user.id,entityType:"StaffWorkingPattern",entityId:pattern.id,afterValue:{organisationId,staffId,version:pattern.version,occurrencesGenerated:generated.length}}});
  return{pattern,occurrencesGenerated:generated.length};
 },serial);
}

export async function createScheduleException(user:User,staffId:string,input:{startDate:string;endDate:string;startTime?:string;endTime?:string;type:Prisma.StaffScheduleExceptionCreateInput["type"];paid?:boolean;notes?:string;replacementStaffId?:string}){
 const organisationId=requireOrganisation(user);
 return prisma.$transaction(async tx=>{
  const staff=await tx.staffMember.findFirst({where:{id:staffId,archivedAt:null}});if(!staff)throw Object.assign(new Error("STAFF_NOT_FOUND"),{status:404});
  const exception=await tx.staffScheduleException.create({data:{organisationId,staffId,startDate:dbDate(input.startDate),endDate:dbDate(input.endDate),startTime:input.startTime,endTime:input.endTime,type:input.type,paid:input.paid??false,notes:input.notes,replacementStaffId:input.replacementStaffId,createdById:user.id}});
  await tx.auditLog.create({data:{action:"STAFF_SCHEDULE_EXCEPTION_CREATED",actorType:"USER",actorId:user.id,entityType:"StaffScheduleException",entityId:exception.id,afterValue:{organisationId,staffId,type:input.type,startDate:input.startDate,endDate:input.endDate}}});
  return exception;
 },serial);
}

export async function previewStaffEndDate(user:User,staffId:string,endDate:string){
 const organisationId=requireOrganisation(user),date=dbDate(endDate);
 const [futureShifts,assignments]=await Promise.all([
  prisma.staffScheduleOccurrence.count({where:{organisationId,staffId,startAt:{gt:date},status:{not:"CANCELLED"}}}),
  prisma.operationStaffAssignment.count({where:{organisationId,staffId,status:"ASSIGNED",occurrence:{startAt:{gt:date},status:{notIn:["COMPLETED","CANCELLED"]}}}})
 ]);
 return{staffId,endDate,futureShiftsAffected:futureShifts,operationAssignmentsAffected:assignments,replacementRequirements:assignments,historicalRecordsPreserved:true};
}

export async function confirmStaffEndDate(user:User,staffId:string,endDate:string){
 const organisationId=requireOrganisation(user),date=dbDate(endDate);
 return prisma.$transaction(async tx=>{
  const staff=await tx.staffMember.findFirst({where:{id:staffId,archivedAt:null}});if(!staff)throw Object.assign(new Error("STAFF_NOT_FOUND"),{status:404});
  const shifts=await tx.staffScheduleOccurrence.updateMany({where:{organisationId,staffId,startAt:{gt:date},status:{not:"CANCELLED"}},data:{status:"CANCELLED"}});
  const assignments=await tx.operationStaffAssignment.updateMany({where:{organisationId,staffId,status:"ASSIGNED",occurrence:{startAt:{gt:date},status:{notIn:["COMPLETED","CANCELLED"]}}},data:{status:"REPLACEMENT_REQUIRED"}});
  await tx.staffWorkingPattern.updateMany({where:{organisationId,staffId,active:true},data:{effectiveEnd:date,active:false}});
  await tx.staffMember.update({where:{id:staffId},data:{endDate:date}});
  await tx.auditLog.create({data:{action:"STAFF_END_DATE_CONFIRMED",actorType:"USER",actorId:user.id,entityType:"StaffMember",entityId:staffId,beforeValue:{endDate:staff.endDate},afterValue:{organisationId,endDate,shiftsCancelled:shifts.count,assignmentsFlagged:assignments.count,historicalRecordsPreserved:true}}});
  return{shiftsCancelled:shifts.count,assignmentsFlagged:assignments.count};
 },serial);
}

export async function createOperation(user:User,input:{title:string;type:string;description?:string;internalNotes?:string;startAt:string;endAt:string;timezone?:string;location?:string;premisesName?:string;roomName?:string;requiredStaffCount?:number;requiresCompliance?:boolean;recurrenceRule?:Prisma.InputJsonValue}){
 const organisationId=requireOrganisation(user);
 return prisma.$transaction(async tx=>{
  const operation=await tx.operation.create({data:{organisationId,title:input.title,type:input.type,description:input.description,internalNotes:input.internalNotes,createdById:user.id}});
  const series=input.recurrenceRule?await tx.operationSeries.create({data:{organisationId,operationId:operation.id,recurrenceRule:input.recurrenceRule,timezone:input.timezone??"Europe/London"}}):null;
  const dates=input.recurrenceRule?expandRecurrence(new Date(input.startAt),new Date(input.endAt),input.recurrenceRule as never,input.timezone??"Europe/London"):[{startAt:new Date(input.startAt),endAt:new Date(input.endAt)}];
  const occurrences=[];for(const dateslot of dates)occurrences.push(await tx.operationOccurrence.create({data:{organisationId,operationId:operation.id,seriesId:series?.id,startAt:dateslot.startAt,endAt:dateslot.endAt,timezone:input.timezone??"Europe/London",location:input.location,premisesName:input.premisesName,roomName:input.roomName,requiredStaffCount:input.requiredStaffCount??0,requiresCompliance:input.requiresCompliance??false}}));const occurrence=occurrences[0];
  await tx.auditLog.create({data:{action:"OPERATION_CREATED",actorType:"USER",actorId:user.id,entityType:"Operation",entityId:operation.id,afterValue:{organisationId,occurrenceId:occurrence.id,type:input.type,status:"DRAFT"}}});
  return{operation,series,occurrence,occurrencesCreated:occurrences.length};
 },serial);
}

export async function calculateAndStoreReadiness(user:User,occurrenceId:string){
 const organisationId=requireOrganisation(user);
 return prisma.$transaction(async tx=>{
  const occurrence=await tx.operationOccurrence.findFirst({where:{id:occurrenceId,organisationId},include:{assignments:true}});
  if(!occurrence)throw Object.assign(new Error("OPERATION_NOT_FOUND"),{status:404});
  const result=calculateReadiness({cancelled:occurrence.status==="CANCELLED",requiredStaffCount:occurrence.requiredStaffCount,assignedStaffCount:occurrence.assignments.filter(a=>a.status==="ASSIGNED").length,requiresCompliance:occurrence.requiresCompliance,approvedCompliance:!occurrence.requiresCompliance});
  await tx.operationOccurrence.update({where:{id:occurrence.id},data:{readiness:result.level}});
  const snapshot=await tx.operationReadinessSnapshot.create({data:{organisationId,occurrenceId,level:result.level,blockers:result.blockers,warnings:result.warnings,calculatedById:user.id}});
  await tx.auditLog.create({data:{action:"OPERATION_READINESS_CALCULATED",actorType:"USER",actorId:user.id,entityType:"OperationOccurrence",entityId:occurrenceId,afterValue:{organisationId,...result}}});
  return{...result,snapshotId:snapshot.id};
 },serial);
}

export async function transitionOperation(user:User,occurrenceId:string,to:OperationStatus){
 const organisationId=requireOrganisation(user);
 return prisma.$transaction(async tx=>{
  const occurrence=await tx.operationOccurrence.findFirst({where:{id:occurrenceId,organisationId}});if(!occurrence)throw Object.assign(new Error("OPERATION_NOT_FOUND"),{status:404});
  assertOperationTransition(occurrence.status,to);
  if(["READY","ACTIVE"].includes(to)&&occurrence.readiness!=="READY")throw Object.assign(new Error("OPERATION_NOT_READY"),{status:409});
  const updated=await tx.operationOccurrence.update({where:{id:occurrenceId},data:{status:to,cancelledAt:to==="CANCELLED"?new Date():undefined,completedAt:to==="COMPLETED"?new Date():undefined}});
  await tx.auditLog.create({data:{action:"OPERATION_STATUS_CHANGED",actorType:"USER",actorId:user.id,entityType:"OperationOccurrence",entityId:occurrenceId,beforeValue:{status:occurrence.status},afterValue:{organisationId,status:to}}});
  return updated;
 },serial);
}

export async function assignOperationStaff(user:User,occurrenceId:string,input:{staffId:string;responsibility?:string;lead?:boolean}){
 const organisationId=requireOrganisation(user);
 return prisma.$transaction(async tx=>{
  const occurrence=await tx.operationOccurrence.findFirst({where:{id:occurrenceId,organisationId,status:{notIn:["COMPLETED","CANCELLED"]}}});if(!occurrence)throw Object.assign(new Error("OPERATION_NOT_FOUND"),{status:404});
  const staff=await tx.staffMember.findFirst({where:{id:input.staffId,active:true,archivedAt:null,OR:[{endDate:null},{endDate:{gte:occurrence.startAt}}]}});if(!staff)throw Object.assign(new Error("STAFF_UNAVAILABLE"),{status:409});
  const conflict=await tx.operationStaffAssignment.findFirst({where:{organisationId,staffId:input.staffId,status:"ASSIGNED",occurrence:{id:{not:occurrenceId},status:{notIn:["COMPLETED","CANCELLED"]},startAt:{lt:occurrence.endAt},endAt:{gt:occurrence.startAt}}}});
  if(conflict)throw Object.assign(new Error("STAFF_ASSIGNMENT_CONFLICT"),{status:409});
  const assignment=await tx.operationStaffAssignment.upsert({where:{occurrenceId_staffId:{occurrenceId,staffId:input.staffId}},update:{status:"ASSIGNED",responsibility:input.responsibility,lead:input.lead??false},create:{organisationId,occurrenceId,staffId:input.staffId,responsibility:input.responsibility,lead:input.lead??false,createdById:user.id}});
  await tx.auditLog.create({data:{action:"OPERATION_STAFF_ASSIGNED",actorType:"USER",actorId:user.id,entityType:"OperationStaffAssignment",entityId:assignment.id,afterValue:{organisationId,occurrenceId,staffId:input.staffId,lead:assignment.lead}}});
  return assignment;
 },serial);
}

export async function addOperationAttendee(user:User,occurrenceId:string,input:{studentId:string;status?:Prisma.OperationAttendeeCreateInput["status"];transportMode?:string;supportLevel?:string;operationalNotes?:string}){
 const organisationId=requireOrganisation(user);
 return prisma.$transaction(async tx=>{
  const occurrence=await tx.operationOccurrence.findFirst({where:{id:occurrenceId,organisationId,status:{notIn:["COMPLETED","CANCELLED"]}}});if(!occurrence)throw Object.assign(new Error("OPERATION_NOT_FOUND"),{status:404});
  const student=await tx.student.findFirst({where:{id:input.studentId,active:true,archivedAt:null}});if(!student)throw Object.assign(new Error("STUDENT_NOT_FOUND"),{status:404});
  const attendee=await tx.operationAttendee.upsert({where:{occurrenceId_studentId:{occurrenceId,studentId:input.studentId}},update:{status:input.status??"PLANNED",transportMode:input.transportMode,supportLevel:input.supportLevel,operationalNotes:input.operationalNotes},create:{organisationId,occurrenceId,studentId:input.studentId,status:input.status??"PLANNED",transportMode:input.transportMode,supportLevel:input.supportLevel,operationalNotes:input.operationalNotes,createdById:user.id}});
  await tx.auditLog.create({data:{action:"OPERATION_ATTENDEE_ADDED",actorType:"USER",actorId:user.id,entityType:"OperationAttendee",entityId:attendee.id,afterValue:{organisationId,occurrenceId,studentId:input.studentId,status:attendee.status}}});
  return attendee;
 },serial);
}

export async function reconcileExpectedDay(user:User,dateValue:string,now=new Date()){
 const organisationId=requireOrganisation(user),day=dbDate(dateValue),next=new Date(day.getTime()+86400000);
 return prisma.$transaction(async tx=>{
  const expected=await tx.expectedStaffAttendance.findMany({where:{organisationId,date:{gte:day,lt:next}}});
  let discrepancies=0;
  for(const record of expected){
   const events=await tx.clockEvent.findMany({where:{staffId:record.staffId,deviceTimestamp:{gte:new Date(record.expectedStartAt.getTime()-4*3600000),lte:new Date(record.expectedEndAt.getTime()+8*3600000)}},orderBy:{deviceTimestamp:"asc"}});
   const clockIn=events.find(e=>e.type==="CLOCK_IN"),clockOut=[...events].reverse().find(e=>e.type==="CLOCK_OUT"&&(!clockIn||e.deviceTimestamp>clockIn.deviceTimestamp));
   const result=reconcileAttendance({expectedStartAt:record.expectedStartAt,expectedEndAt:record.expectedEndAt,now,clockInAt:clockIn?.deviceTimestamp,clockOutAt:clockOut?.deviceTimestamp});
   if(["LATE","MISSING_CLOCK_IN","MISSING_CLOCK_OUT"].includes(result.state))discrepancies++;
   await tx.expectedStaffAttendance.update({where:{id:record.id},data:{state:result.state}});
   await tx.attendanceReconciliation.upsert({where:{expectedAttendanceId:record.id},update:{clockInEventId:clockIn?.id,clockOutEventId:clockOut?.id,state:result.state,minutesLate:result.minutesLate,minutesShort:result.minutesShort,calculatedAt:new Date()},create:{organisationId,expectedAttendanceId:record.id,clockInEventId:clockIn?.id,clockOutEventId:clockOut?.id,state:result.state,minutesLate:result.minutesLate,minutesShort:result.minutesShort}});
  }
  await tx.auditLog.create({data:{action:"ATTENDANCE_RECONCILIATION_CALCULATED",actorType:"USER",actorId:user.id,entityType:"ExpectedStaffAttendance",afterValue:{organisationId,date:dateValue,records:expected.length,discrepancies}}});
  return{date:dateValue,records:expected.length,discrepancies};
 },serial);
}

export async function reviewScheduleException(user:User,staffId:string,exceptionId:string,approvalStatus:"APPROVED"|"REJECTED"){
 const organisationId=requireOrganisation(user);
 return prisma.$transaction(async tx=>{
  const exception=await tx.staffScheduleException.findFirst({where:{id:exceptionId,staffId,organisationId}});if(!exception)throw Object.assign(new Error("SCHEDULE_EXCEPTION_NOT_FOUND"),{status:404});
  const updated=await tx.staffScheduleException.update({where:{id:exceptionId},data:{approvalStatus,approvedById:user.id}});
  let occurrencesChanged=0;
  if(approvalStatus==="APPROVED"){
   const endExclusive=new Date(exception.endDate.getTime()+86400000);
   const status=exception.type==="SICKNESS"?"SICKNESS":exception.type==="TRAINING"?"TRAINING":["ANNUAL_LEAVE","UNPAID_LEAVE","NON_WORKING_DAY"].includes(exception.type)?"LEAVE":"CHANGED";
   const result=await tx.staffScheduleOccurrence.updateMany({where:{organisationId,staffId,date:{gte:exception.startDate,lt:endExclusive},manuallyModified:false,status:{not:"CANCELLED"}},data:{status}});
   occurrencesChanged=result.count;
   if(["LEAVE","SICKNESS"].includes(status))await tx.expectedStaffAttendance.updateMany({where:{organisationId,staffId,date:{gte:exception.startDate,lt:endExclusive}},data:{state:"ABSENT_APPROVED"}});
  }
  await tx.auditLog.create({data:{action:"STAFF_SCHEDULE_EXCEPTION_REVIEWED",actorType:"USER",actorId:user.id,entityType:"StaffScheduleException",entityId:exceptionId,beforeValue:{approvalStatus:exception.approvalStatus},afterValue:{organisationId,approvalStatus,occurrencesChanged}}});
  return{exception:updated,occurrencesChanged};
 },serial);
}
