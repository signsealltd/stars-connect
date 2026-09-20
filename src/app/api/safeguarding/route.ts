import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {refreshSafeguarding} from "@/lib/safeguarding-service";
import {audit} from "@/lib/audit";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.SAFEGUARDING_MANAGE,async()=>{
 const policy=await refreshSafeguarding();const history=req.nextUrl.searchParams.get("history")==="true";
 const openCount=await prisma.safeguardingEnquiry.count({where:{status:"OPEN"}});
 if(req.nextUrl.searchParams.get("summary")==="true")return NextResponse.json({policy,openCount},{headers:{"Cache-Control":"private, no-store"}});
 const requestedPage=Number(req.nextUrl.searchParams.get("page")||1);
 const page=Number.isSafeInteger(requestedPage)&&requestedPage>0?Math.min(requestedPage,100000):1;
 const where=history?{}:{status:"OPEN"};
 const total=history?await prisma.safeguardingEnquiry.count({where}):openCount;
 const rows=await prisma.safeguardingEnquiry.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],take:25,skip:(page-1)*25});
 const students=await prisma.student.findMany({where:{id:{in:rows.map(r=>r.studentId)}},select:{id:true,displayName:true}});
 return NextResponse.json({policy,openCount,total,page,rows:rows.map(r=>({...r,studentName:students.find(s=>s.id===r.studentId)?.displayName||"Student"}))},{headers:{"Cache-Control":"private, no-store"}});
});}
const schema=z.discriminatedUnion("action",[z.object({action:z.literal("close"),id:z.string().uuid(),outcome:z.enum(["NO_CONCERNS","REFERRED"]),notes:z.string().trim().min(5).max(5000)}),z.object({action:z.literal("policy"),mode:z.enum(["ACCUMULATED","CONSECUTIVE"]),windowDays:z.number().int().min(0).max(365)})]);
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.SAFEGUARDING_MANAGE,async user=>{
 const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Check the details and record investigation notes.",422);const d=p.data;
 if(d.action==="policy"){await prisma.appSetting.upsert({where:{key:"absencePolicy"},update:{value:{mode:d.mode,windowDays:d.windowDays},updatedBy:user.id},create:{key:"absencePolicy",value:{mode:d.mode,windowDays:d.windowDays},updatedBy:user.id}});await audit("ABSENCE_POLICY_CHANGED",{actorType:"USER",actorId:user.id,afterValue:d});return NextResponse.json({ok:true});}
 const changed=await prisma.safeguardingEnquiry.updateMany({where:{id:d.id,status:"OPEN"},data:{status:d.outcome,notes:d.notes,closedById:user.id,closedByName:user.name,closedAt:new Date()}});
 if(!changed.count)return jsonError("This enquiry has already been closed. Refresh the dashboard.",409);
 await audit("SAFEGUARDING_ENQUIRY_CLOSED",{actorType:"USER",actorId:user.id,entityType:"SafeguardingEnquiry",entityId:d.id,afterValue:{outcome:d.outcome}});
 return NextResponse.json({ok:true});
});}
