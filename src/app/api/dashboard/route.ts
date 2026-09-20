import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api";
import { localDateAsDatabaseDate, localDateKey, localDayBounds } from "@/lib/dates";
import { staffDashboardMetrics, studentDashboardMetrics } from "@/lib/dashboard-metrics";
import { deviceOperationalStatus } from "@/lib/devices";
import {effectiveClockEvent} from "@/lib/timesheets";
import {hasCapability,CAPABILITIES} from "@/lib/permission-catalog";
import { staffOccupancy } from "@/lib/staff-presence";

export async function GET(req:NextRequest){
 return withRole(req,"RECEPTION",async user=>{
  const date=localDateKey(),dbDate=localDateAsDatabaseDate(date),{start,end}=localDayBounds(date);
  const[events,latestStaffEvents,attendance,students,devices,conflicts,corrections,rollCall,email,activeVisitors,payrollAwaiting,billingAwaiting,dailyReport]=await Promise.all([
   prisma.clockEvent.findMany({where:{deviceTimestamp:{gte:start,lte:end},device:{isSeedData:false,lastSyncAt:{not:null}}},include:{staff:true},orderBy:{deviceTimestamp:"desc"}}),
   prisma.staffMember.findMany({where:{active:true,clockingEnabled:true},select:{id:true,displayName:true,clockEvents:{where:{device:{isSeedData:false,lastSyncAt:{not:null}}},orderBy:{deviceTimestamp:"desc"},select:{id:true,deviceId:true,type:true,deviceTimestamp:true,missingClockOutResolvedAt:true,corrections:{orderBy:{createdAt:"asc"},select:{newValue:true}}}},presenceEvents:{where:{device:{isSeedData:false,lastSyncAt:{not:null}}},orderBy:{deviceTimestamp:"desc"},take:1,select:{type:true,deviceTimestamp:true}}}}),
   prisma.studentAttendance.findMany({where:{date:dbDate,device:{isSeedData:false,lastSyncAt:{not:null}}},include:{student:true},orderBy:{updatedAt:"desc"}}),
   prisma.student.findMany({where:{active:true},select:{id:true,expectedDays:true}}),
   prisma.device.findMany({where:{isSeedData:false,deletedAt:null},select:{id:true,name:true,lastSyncAt:true,lastSeenAt:true,status:true,pendingEventCount:true,currentCursor:true,appVersion:true,batteryLevel:true,batteryCharging:true,batteryUpdatedAt:true,syncRequestedAt:true}}),
   prisma.syncConflict.count({where:{status:"OPEN"}}),
   prisma.clockCorrection.count({where:{createdAt:{gte:start,lte:end}}}),
   prisma.emergencyRollCall.findFirst({where:{status:"ACTIVE"},orderBy:{startedAt:"desc"},include:{entries:true}}),
   prisma.dailySummaryEmail.findFirst({where:{date:dbDate},orderBy:{attemptedAt:"desc"}}),
   prisma.visitorVisit.count({where:{signedOutAt:null,emergencyIncluded:true}}),
   prisma.payrollPeriod.count({where:{status:{in:["REQUIRES_REVIEW","REVIEWED"]}}}),
   prisma.billingRun.count({where:{status:{in:["REQUIRES_REVIEW","REVIEWED"]}}}),
   prisma.dailyAttendanceReport.findFirst({orderBy:[{reportDate:"desc"},{version:"desc"}],select:{id:true,status:true,reportDate:true,exceptionCount:true}}),
  ]);
  const deviceConflicts=await prisma.syncConflict.groupBy({by:["deviceId"],where:{status:"OPEN"},_count:{_all:true}});
  for(const staff of latestStaffEvents)staff.clockEvents=staff.clockEvents.map(effectiveClockEvent).sort((a,b)=>b.deviceTimestamp.getTime()-a.deviceTimestamp.getTime()).slice(0,1);
  const missingClockOuts=latestStaffEvents.flatMap(staff=>{const event=staff.clockEvents[0];return event?.type==="CLOCK_IN"&&event.deviceTimestamp<start&&!event.missingClockOutResolvedAt?[{id:event.id,name:staff.displayName,time:event.deviceTimestamp}]:[]});
  const staffMetrics=staffDashboardMetrics(latestStaffEvents.flatMap(staff=>staff.clockEvents),start);
  staffMetrics.staffIn=latestStaffEvents.filter(staff=>staff.clockEvents[0]?.deviceTimestamp>=start&&staffOccupancy(staff.clockEvents[0],staff.presenceEvents[0])==="ONSITE").length;
  const staffOffsite=latestStaffEvents.filter(staff=>staff.clockEvents[0]?.deviceTimestamp>=start&&staffOccupancy(staff.clockEvents[0],staff.presenceEvents[0])==="OFFSITE").length;
  const studentMetrics=studentDashboardMetrics(students,attendance,date);
  return NextResponse.json({
   role:user.role,userName:user.name,date,...staffMetrics,missingClockOut:missingClockOuts.length,missingClockOuts,canResolveClockOut:hasCapability(user.role,CAPABILITIES.TIMESHEETS_MANAGE,user.permissionOverrides),staffOffsite,...studentMetrics,activeVisitors,
   review:events.filter(e=>e.reviewRequired).length+conflicts,
   conflicts,corrections,payrollAwaiting,billingAwaiting,dailyReport,emergency:rollCall?{id:rollCall.id,startedAt:rollCall.startedAt,missing:rollCall.entries.filter(e=>!e.accountedFor).length}:null,
   email:email?{status:email.status,sentAt:email.sentAt,failureReason:email.failureReason}:null,
   recentEvents:events.slice(0,8).map(e=>({id:e.id,name:e.staff.displayName,type:e.type,time:e.deviceTimestamp})),
   recentAttendance:attendance.slice(0,8).map(a=>({id:a.id,name:a.student.displayName,status:a.status,time:a.updatedAt})),
   devices:devices.map(d=>({...d,conflictCount:deviceConflicts.find(c=>c.deviceId===d.id)?._count._all||0,currentCursor:String(d.currentCursor),operationalStatus:deviceOperationalStatus(d),syncPending:Boolean(d.syncRequestedAt&&(!d.lastSyncAt||d.syncRequestedAt>d.lastSyncAt))})),
  },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
 })
}
