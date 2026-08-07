import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api";
import { localDateAsDatabaseDate, localDateKey, localDayBounds } from "@/lib/dates";
import { staffDashboardMetrics, studentDashboardMetrics } from "@/lib/dashboard-metrics";
import { deviceOperationalStatus } from "@/lib/devices";
import { staffOccupancy } from "@/lib/staff-presence";

export async function GET(req:NextRequest){
 return withRole(req,"RECEPTION",async user=>{
  const date=localDateKey(),dbDate=localDateAsDatabaseDate(date),{start,end}=localDayBounds(date);
  const[events,latestStaffEvents,attendance,students,devices,conflicts,corrections,rollCall,email,activeVisitors,payrollAwaiting,billingAwaiting,dailyReport]=await Promise.all([
   prisma.clockEvent.findMany({where:{deviceTimestamp:{gte:start,lte:end},device:{isSeedData:false,lastSyncAt:{not:null}}},include:{staff:true},orderBy:{deviceTimestamp:"desc"}}),
   prisma.staffMember.findMany({where:{active:true,clockingEnabled:true},select:{clockEvents:{where:{device:{isSeedData:false,lastSyncAt:{not:null}}},orderBy:{deviceTimestamp:"desc"},take:1,select:{type:true,deviceTimestamp:true}},presenceEvents:{where:{device:{isSeedData:false,lastSyncAt:{not:null}}},orderBy:{deviceTimestamp:"desc"},take:1,select:{type:true,deviceTimestamp:true}}}}),
   prisma.studentAttendance.findMany({where:{date:dbDate,device:{isSeedData:false,lastSyncAt:{not:null}}},include:{student:true},orderBy:{updatedAt:"desc"}}),
   prisma.student.findMany({where:{active:true},select:{id:true,expectedDays:true}}),
   prisma.device.findMany({where:{isSeedData:false},select:{id:true,name:true,lastSyncAt:true,lastSeenAt:true,status:true,pendingEventCount:true,currentCursor:true,appVersion:true,batteryLevel:true,batteryCharging:true,batteryUpdatedAt:true,syncRequestedAt:true}}),
   prisma.syncConflict.count({where:{status:"OPEN"}}),
   prisma.clockCorrection.count({where:{createdAt:{gte:start,lte:end}}}),
   prisma.emergencyRollCall.findFirst({where:{status:"ACTIVE"},orderBy:{startedAt:"desc"},include:{entries:true}}),
   prisma.dailySummaryEmail.findFirst({where:{date:dbDate},orderBy:{attemptedAt:"desc"}}),
   prisma.visitorVisit.count({where:{signedOutAt:null,emergencyIncluded:true}}),
   prisma.payrollPeriod.count({where:{status:{in:["REQUIRES_REVIEW","REVIEWED"]}}}),
   prisma.billingRun.count({where:{status:{in:["REQUIRES_REVIEW","REVIEWED"]}}}),
   prisma.dailyAttendanceReport.findFirst({orderBy:[{reportDate:"desc"},{version:"desc"}],select:{id:true,status:true,reportDate:true,exceptionCount:true}}),
  ]);
  const staffMetrics=staffDashboardMetrics(latestStaffEvents.flatMap(staff=>staff.clockEvents),start);
  staffMetrics.staffIn=latestStaffEvents.filter(staff=>staffOccupancy(staff.clockEvents[0],staff.presenceEvents[0])==="ONSITE").length;
  const staffOffsite=latestStaffEvents.filter(staff=>staffOccupancy(staff.clockEvents[0],staff.presenceEvents[0])==="OFFSITE").length;
  const studentMetrics=studentDashboardMetrics(students,attendance,date);
  return NextResponse.json({
   role:user.role,date,...staffMetrics,staffOffsite,...studentMetrics,activeVisitors,
   review:events.filter(e=>e.reviewRequired).length+conflicts,
   conflicts,corrections,payrollAwaiting,billingAwaiting,dailyReport,emergency:rollCall?{id:rollCall.id,startedAt:rollCall.startedAt,missing:rollCall.entries.filter(e=>!e.accountedFor).length}:null,
   email:email?{status:email.status,sentAt:email.sentAt,failureReason:email.failureReason}:null,
   recentEvents:events.slice(0,8).map(e=>({id:e.id,name:e.staff.displayName,type:e.type,time:e.deviceTimestamp})),
   recentAttendance:attendance.slice(0,8).map(a=>({id:a.id,name:a.student.displayName,status:a.status,time:a.updatedAt})),
   devices:devices.map(d=>({...d,currentCursor:String(d.currentCursor),operationalStatus:deviceOperationalStatus(d),syncPending:Boolean(d.syncRequestedAt&&(!d.lastSyncAt||d.syncRequestedAt>d.lastSyncAt))})),
  },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
 })
}
