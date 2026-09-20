import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {calculateFundedRun,createBillingTask} from "@/lib/funded-billing-service";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_REVIEW,async()=>NextResponse.json(await prisma.billingRun.findMany({include:{_count:{select:{charges:true,invoices:true}}},orderBy:{periodStart:"desc"}})));}
const schema=z.object({periodStart:z.string().date(),periodEnd:z.string().date(),requestKey:z.string().uuid(),label:z.string().trim().min(1).max(191).optional(),studentIds:z.array(z.string().uuid()).min(1).max(500).optional(),historicalMode:z.boolean().default(false),notes:z.string().max(2000).optional()});
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_EDIT,async user=>{
  const parsed=schema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success||parsed.data.periodEnd<parsed.data.periodStart)return jsonError("Choose valid dates.",422);
  const d=parsed.data,periodStart=new Date(d.periodStart),periodEnd=new Date(d.periodEnd);
  if(periodEnd.getTime()-periodStart.getTime()>366*86400000)return jsonError("Select no more than one year.",422);
  if(d.studentIds&&await prisma.student.count({where:{id:{in:d.studentIds}}})!==new Set(d.studentIds).size)return jsonError("One or more students are unavailable.",422);
  const existing=await prisma.billingRun.findUnique({where:{requestKey:d.requestKey}});
  if(existing)return NextResponse.json(existing);
  const row=await prisma.$transaction(async tx=>{
    await tx.appSetting.upsert({where:{key:"billingRunLock"},update:{updatedBy:user.id},create:{key:"billingRunLock",value:true,updatedBy:user.id}});
    const duplicate=await tx.billingRun.findUnique({where:{requestKey:d.requestKey}});if(duplicate)return duplicate;
    const previous=await tx.billingRun.findFirst({where:{periodStart,periodEnd},orderBy:{version:"desc"}});
    return tx.billingRun.create({data:{periodStart,periodEnd,requestKey:d.requestKey,notes:d.notes,label:d.label,selectedStudentIds:d.studentIds,historicalMode:d.historicalMode,version:(previous?.version||0)+1,createdById:user.id,supersedesRunId:previous?.id,revisionReason:previous?"Manager requested regeneration":null}});
  });
  await calculateFundedRun(row.id);
  const payers=await prisma.billingCharge.findMany({where:{billingRunId:row.id},select:{payerName:true},distinct:["payerName"]});
  for(const payer of payers)await createBillingTask(row.id,payer.payerName,periodStart,periodEnd,user.id);
  return NextResponse.json(row,{status:201});
});}
