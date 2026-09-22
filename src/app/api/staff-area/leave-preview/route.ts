import {CAPABILITIES} from "@/lib/permissions";
import {fromZonedTime} from "date-fns-tz";
import {NextRequest} from "next/server";
import {withStaff,staffJson} from "@/lib/staff-area-auth";
import {prisma} from "@/lib/prisma";
import {plannedStaffShifts} from "@/lib/staff-planning";
export async function GET(req:NextRequest){return withStaff(req,async i=>{
 const a=req.nextUrl.searchParams.get('start')||'',b=req.nextUrl.searchParams.get('end')||'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(a)||!/^\d{4}-\d{2}-\d{2}$/.test(b)||b<a||Date.parse(b)-Date.parse(a)>366*86400000)return staffJson({error:'Choose valid dates within one year.'},422);
 const start=new Date(a),end=new Date(b),organisationId=i.user.organisationId!,staffId=i.staff.id;
 const [patterns,stored,absences]=await Promise.all([
 prisma.staffWorkingPattern.findMany({where:{staffId,organisationId,active:true,effectiveStart:{lte:end},OR:[{effectiveEnd:null},{effectiveEnd:{gte:start}}]},include:{intervals:true,staff:{select:{displayName:true,startDate:true,endDate:true}}}}),
 prisma.staffScheduleOccurrence.findMany({where:{staffId,organisationId,date:{gte:start,lte:end}},include:{staff:{select:{displayName:true,startDate:true,endDate:true}}}}),
 prisma.staffScheduleException.findMany({where:{staffId,organisationId,approvalStatus:'APPROVED',startDate:{lte:end},endDate:{gte:start}},select:{startDate:true,endDate:true,type:true}})]);
 let shifts=plannedStaffShifts(patterns,stored,[],start,end);const from=req.nextUrl.searchParams.get("from"),to=req.nextUrl.searchParams.get("to");if(from&&to&&/^([01]\d|2[0-3]):[0-5]\d$/.test(from)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(to)){shifts=shifts.map(s=>{const day=s.date.toISOString().slice(0,10);return {...s,startAt:new Date(Math.max(+s.startAt,+fromZonedTime(day+"T"+from+":00","Europe/London"))),endAt:new Date(Math.min(+s.endAt,+fromZonedTime(day+"T"+to+":00","Europe/London")))}}).filter(s=>s.endAt>s.startAt);}return staffJson({days:new Set(shifts.map(s=>s.date.toISOString())).size,hours:Math.round(shifts.reduce((n,s)=>n+(+s.endAt-+s.startAt)/3600000,0)*100)/100,known:patterns.length+stored.length>0,conflicts:absences.map(a=>({type:a.type,start:a.startDate,end:a.endDate}))});
},CAPABILITIES.STAFF_OWN_REQUEST)}
