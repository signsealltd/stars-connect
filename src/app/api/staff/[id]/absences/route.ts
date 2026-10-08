import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {requireOrganisation} from "@/lib/compliance-service";
import {localDateKey} from "@/lib/dates";
import {getOrganisationSettings} from "@/lib/organisation-settings";
import {plannedStaffShifts} from "@/lib/staff-planning";
import {absenceSummary,dateKey,leaveYear,shiftDate,type WorkDay} from "@/lib/staff-absence-summary";
import {saveHr} from "@/lib/staff-hr-service";
import {hrEmployment} from "@/lib/staff-hr";

type Params={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:Params){return withCapability(req,CAPABILITIES.STAFF_HR_VIEW,async user=>{
  const {id}=await params,organisationId=requireOrganisation(user),today=localDateKey();
  const staff=await prisma.staffMember.findUnique({where:{id},include:{hrRecord:true}});
  if(!staff)return jsonError("Staff member not found.",404);
  const settings=await getOrganisationSettings();
  let year=leaveYear(today,settings.leaveYearStartMonth,settings.leaveYearStartDay);
  const requested=req.nextUrl.searchParams.get("year");
  if(requested){if(!/^\d{4}$/.test(requested)||+requested<2000||+requested>2100)return jsonError("Choose a valid leave year.",422);year=leaveYear(`${requested}-12-31`,settings.leaveYearStartMonth,settings.leaveYearStartDay);}
  const from=[year.start,shiftDate(today,-363)].sort()[0],to=[year.end,today].sort().at(-1)!;
  const [patterns,stored,records,pending]=await Promise.all([
    prisma.staffWorkingPattern.findMany({where:{staffId:id,organisationId,active:true,effectiveStart:{lte:new Date(to)},OR:[{effectiveEnd:null},{effectiveEnd:{gte:new Date(from)}}]},include:{intervals:true,staff:{select:{displayName:true,startDate:true,endDate:true}}}}),
    prisma.staffScheduleOccurrence.findMany({where:{staffId:id,organisationId,date:{gte:new Date(from),lte:new Date(to)}},include:{staff:{select:{displayName:true,startDate:true,endDate:true}}}}),
    prisma.staffScheduleException.findMany({where:{staffId:id,organisationId,type:{in:["ANNUAL_LEAVE","SICKNESS"]}},orderBy:{startDate:"desc"}}),
    prisma.staffRequest.count({where:{staffId:id,organisationId,type:"LEAVE",status:{in:["NEW","IN_REVIEW","WAITING"]}}}),
  ]);
  const work=new Map<string,WorkDay>();
  // The schedule generator intentionally limits each projection to 93 days.
  for(let start=from;start<=to;start=shiftDate(start,90)){
    const end=shiftDate(start,89)<to?shiftDate(start,89):to;
    for(const shift of plannedStaffShifts(patterns,stored.filter(s=>dateKey(s.date)>=start&&dateKey(s.date)<=end),[],new Date(start),new Date(end))){
      const key=dateKey(shift.date),day=work.get(key)||{date:key,intervals:[]};day.intervals.push([+shift.startAt,+shift.endAt]);work.set(key,day);
    }
  }
  const employment=hrEmployment.parse(staff.hrRecord?.employment||{});
  const allowance=employment.holidayAllowances?.find(a=>a.yearStart===year.start);
  const summary=absenceSummary({today,year,absences:records.map(a=>({...a,startDate:dateKey(a.startDate),endDate:dateKey(a.endDate)})),workDays:[...work.values()],
    knownDate:day=>patterns.some(p=>dateKey(p.effectiveStart)<=day&&(!p.effectiveEnd||dateKey(p.effectiveEnd)>=day))||stored.some(s=>dateKey(s.date)===day),
    employmentStart:dateKey(staff.startDate),employmentEnd:staff.endDate?dateKey(staff.endDate):null,entitlementDays:allowance?.entitlementDays??null,carryOverDays:allowance?.carryOverDays??0});
  await prisma.auditLog.create({data:{action:"STAFF_ABSENCE_PROFILE_READ",actorType:"USER",actorId:user.id,entityType:"StaffMember",entityId:id}});
  return NextResponse.json({summary,pending,version:staff.hrRecord?.version||0,
    canEditAllowance:hasCapability(user.role,CAPABILITIES.STAFF_EMPLOYMENT_EDIT,user.permissionOverrides),
    canManage:hasCapability(user.role,CAPABILITIES.STAFF_SCHEDULE_MANAGE,user.permissionOverrides),
    records:records.map(a=>({id:a.id,staffId:id,name:staff.displayName,type:a.type,startDate:dateKey(a.startDate),endDate:dateKey(a.endDate),startTime:a.startTime,endTime:a.endTime,updatedAt:a.updatedAt,approvalStatus:a.approvalStatus,bradfordExcluded:a.bradfordExcluded}))});
});}

const allowanceInput=z.object({yearStart:z.string().date(),entitlementDays:z.number().min(0).max(366),carryOverDays:z.number().min(0).max(366),version:z.number().int().min(0),reason:z.string().trim().min(1).max(2000)});
export async function PUT(req:NextRequest,{params}:Params){return withCapability(req,CAPABILITIES.STAFF_EMPLOYMENT_EDIT,async user=>{
  if(!hasCapability(user.role,CAPABILITIES.STAFF_HR_VIEW,user.permissionOverrides))return jsonError("HR profile access required.",403);
  const {id}=await params,parsed=allowanceInput.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return jsonError("Check the allowance and provide a reason.",422);
  const v=parsed.data,settings=await getOrganisationSettings();
  if(leaveYear(v.yearStart,settings.leaveYearStartMonth,settings.leaveYearStartDay).start!==v.yearStart)return jsonError("Leave-year settings changed. Reload before saving.",409);
  const saved=await prisma.$transaction(async tx=>{
    const old=await tx.staffHrRecord.findUnique({where:{staffId:id}});
    if((old?.version||0)!==v.version)return false;
    const employment=hrEmployment.parse(old?.employment||{});
    const holidayAllowances=[...(employment.holidayAllowances||[]).filter(a=>a.yearStart!==v.yearStart),{yearStart:v.yearStart,entitlementDays:v.entitlementDays,carryOverDays:v.carryOverDays}];
    await saveHr(tx,id,{employment:{holidayAllowances}},user.id,v.reason);return true;
  },{isolationLevel:"Serializable"});
  return saved?NextResponse.json({ok:true}):jsonError("This profile changed. Reload before saving.",409);
});}
