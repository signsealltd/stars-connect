import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api";
import { isExpectedDay, localDateAsDatabaseDate, localDateKey, localDayBounds } from "@/lib/dates";

export async function GET(req:NextRequest){
 return withRole(req,"RECEPTION",async user=>{
  const date=localDateKey(),dbDate=localDateAsDatabaseDate(date),{start,end}=localDayBounds(date);
  const[events,attendance,students,devices,conflicts,corrections,rollCall,email,activeVisitors]=await Promise.all([
   prisma.clockEvent.findMany({where:{deviceTimestamp:{gte:start,lte:end}},include:{staff:true},orderBy:{deviceTimestamp:"desc"}}),
   prisma.studentAttendance.findMany({where:{date:dbDate},include:{student:true},orderBy:{updatedAt:"desc"}}),
   prisma.student.findMany({where:{active:true},select:{id:true,expectedDays:true}}),
   prisma.device.findMany({select:{id:true,name:true,lastSyncAt:true,lastSeenAt:true,status:true,pendingEventCount:true,currentCursor:true}}),
   prisma.syncConflict.count({where:{status:"OPEN"}}),
   prisma.clockCorrection.count({where:{createdAt:{gte:start,lte:end}}}),
   prisma.emergencyRollCall.findFirst({where:{status:"ACTIVE"},orderBy:{startedAt:"desc"},include:{entries:true}}),
   prisma.dailySummaryEmail.findFirst({where:{date:dbDate},orderBy:{attemptedAt:"desc"}}),
   prisma.visitorVisit.count({where:{signedOutAt:null,emergencyIncluded:true}}),
  ]);
  const latest=new Map<string,(typeof events)[number]>();for(const e of events)if(!latest.has(e.staffId))latest.set(e.staffId,e);
  const staffIn=[...latest.values()].filter(e=>e.type==="CLOCK_IN");
  const expectedIds=new Set(students.filter(s=>isExpectedDay(s.expectedDays,date)).map(s=>s.id));
  const markedIds=new Set(attendance.filter(a=>a.status!=="NOT_MARKED").map(a=>a.studentId));
  const staleThreshold=new Date(Date.now()-15*60_000);
  return NextResponse.json({
   role:user.role,date,staffIn:staffIn.length,activeVisitors,present:attendance.filter(a=>a.status==="PRESENT"||a.status==="LATE").length,
   absent:attendance.filter(a=>a.status==="ABSENT").length,late:attendance.filter(a=>a.status==="LATE").length,
   expected:expectedIds.size,notMarked:[...expectedIds].filter(id=>!markedIds.has(id)).length,
   missingClockOut:staffIn.length,review:events.filter(e=>e.reviewRequired).length+conflicts,
   conflicts,corrections,emergency:rollCall?{id:rollCall.id,startedAt:rollCall.startedAt,missing:rollCall.entries.filter(e=>!e.accountedFor).length}:null,
   email:email?{status:email.status,sentAt:email.sentAt,failureReason:email.failureReason}:null,
   recentEvents:events.slice(0,8).map(e=>({id:e.id,name:e.staff.displayName,type:e.type,time:e.deviceTimestamp})),
   recentAttendance:attendance.slice(0,8).map(a=>({id:a.id,name:a.student.displayName,status:a.status,time:a.updatedAt})),
   devices:devices.map(d=>({...d,currentCursor:String(d.currentCursor),stale:d.status==="ACTIVE"&&Boolean(d.lastSeenAt&&d.lastSeenAt<staleThreshold)})),
  });
 })
}
