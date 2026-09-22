import {CAPABILITIES} from "@/lib/permissions";
import {NextRequest,NextResponse} from "next/server";
import {withStaff,staffHeaders,staffJson} from "@/lib/staff-area-auth";
import {prisma} from "@/lib/prisma";
const escape=(v:string)=>v.replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;').replaceAll('\r','');
const date=(v:Date)=>v.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export async function GET(req:NextRequest){return withStaff(req,async i=>{
 const a=await prisma.operationStaffAssignment.findFirst({where:{id:req.nextUrl.searchParams.get('id')||'',staffId:i.staff.id,organisationId:i.user.organisationId!,status:'ASSIGNED',occurrence:{status:{not:'DRAFT'}}},include:{occurrence:{include:{operation:{select:{title:true}}}}}});if(!a)return staffJson({error:'Event unavailable.'},404);
 const o=a.occurrence,content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//STARS Connect//STARS Staff//EN','BEGIN:VEVENT','UID:'+o.id+'@starsconnect.co.uk','DTSTAMP:'+date(new Date()),'DTSTART:'+date(o.startAt),'DTEND:'+date(o.endAt),'SUMMARY:'+escape(o.operation.title),'LOCATION:'+escape(o.location||''),'DESCRIPTION:'+escape(o.staffVisibleNotes||''),'STATUS:'+(o.status==='CANCELLED'?'CANCELLED':'CONFIRMED'),'END:VEVENT','END:VCALENDAR'].join('\r\n');return new NextResponse(content,{headers:{...staffHeaders,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="stars-event.ics"'}});
},CAPABILITIES.STAFF_CALENDAR)}
