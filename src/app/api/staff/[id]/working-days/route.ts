import {NextRequest,NextResponse} from "next/server";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {requireOrganisation} from "@/lib/compliance-service";
import {localDateKey,localDateAsDatabaseDate} from "@/lib/dates";
import {workingDaysInput} from "@/lib/staff-planning";
type Params={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:Params){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_VIEW,async user=>{
 const patterns=await prisma.staffWorkingPattern.findMany({where:{staffId:(await params).id,organisationId:requireOrganisation(user),active:true},include:{intervals:true},orderBy:{effectiveStart:"desc"}});
 return NextResponse.json({patterns,canManage:hasCapability(user.role,CAPABILITIES.STAFF_SCHEDULE_MANAGE,user.permissionOverrides)});
});}
export async function PUT(req:NextRequest,{params}:Params){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_MANAGE,async user=>{
 const parsed=workingDaysInput.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Check the working days and times.",422);
 if(parsed.data.effectiveStart<localDateKey())return jsonError("Schedule changes must start today or later; previous schedules are kept.",422);
 const {id}=await params,organisationId=requireOrganisation(user),input=parsed.data,start=localDateAsDatabaseDate(input.effectiveStart);
 const staff=await prisma.staffMember.findFirst({where:{id,archivedAt:null,active:true}});if(!staff)return jsonError("Active staff member not found.",404);
 if(staff.endDate&&start>staff.endDate)return jsonError("The schedule starts after this staff member's end date.",422);
 const pattern=await prisma.$transaction(async tx=>{
  const latest=await tx.staffWorkingPattern.findFirst({where:{organisationId,staffId:id},orderBy:{version:"desc"}});
  const previousDay=new Date(start.getTime()-86400000);
  await tx.staffWorkingPattern.updateMany({where:{organisationId,staffId:id,active:true,effectiveStart:{lt:start},OR:[{effectiveEnd:null},{effectiveEnd:{gte:start}}]},data:{effectiveEnd:previousDay}});
  await tx.staffWorkingPattern.updateMany({where:{organisationId,staffId:id,active:true,effectiveStart:{gte:start}},data:{active:false}});
  await tx.staffScheduleOccurrence.updateMany({where:{organisationId,staffId:id,patternId:{not:null},date:{gte:start},status:"SCHEDULED",manuallyModified:false},data:{status:"CANCELLED"}});
  const created=await tx.staffWorkingPattern.create({data:{organisationId,staffId:id,name:"Profile working days",effectiveStart:start,timezone:"Europe/London",cycleWeeks:1,version:(latest?.version||0)+1,createdById:user.id,intervals:{create:input.days.map(day=>({...day,weekIndex:1,breakMinutes:0}))}},include:{intervals:true}});
  await tx.staffPortalNotification.create({data:{staffId:id,key:crypto.randomUUID(),message:"Your working days have changed. Please review your schedule.",href:"/staff/schedule"}});
  await tx.auditLog.create({data:{action:"STAFF_WORKING_DAYS_UPDATED",actorType:"USER",actorId:user.id,entityType:"StaffWorkingPattern",entityId:created.id,afterValue:{staffId:id,...input}}});return created;
 },{isolationLevel:"Serializable"});return NextResponse.json({pattern});
});}
