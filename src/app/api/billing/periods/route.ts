import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withCapability, jsonError } from "@/lib/api";
import { CAPABILITIES } from "@/lib/permissions";
import { englandBankHolidays, holidaysInPeriod, lbe2026Periods, monthlyPeriods, type PeriodInput } from "@/lib/billing-periods";
import { audit } from "@/lib/audit";

const periodSchema=z.object({id:z.string().uuid().optional(),label:z.string().trim().min(2).max(191),cycle:z.enum(["LBE","MONTHLY"]),invoiceMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),periodStart:z.string().date(),periodEnd:z.string().date()});
const schema=z.union([periodSchema,z.object({preset:z.literal("LBE_2026")}),z.object({preset:z.literal("MONTHLY"),year:z.number().int().min(2020).max(2100)})]);
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_REVIEW,async()=>NextResponse.json(await prisma.billingPeriod.findMany({orderBy:[{invoiceMonth:"desc"},{cycle:"asc"}]})));}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_EDIT,async user=>{
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Check the billing period details.",422);
 const data=parsed.data;
 const inputs:Array<PeriodInput&{id?:string}>= "preset" in data?(data.preset==="LBE_2026"?lbe2026Periods():monthlyPeriods(data.year)):[data];
 for(const input of inputs){
  const length=(new Date(input.periodEnd).getTime()-new Date(input.periodStart).getTime())/86400000+1;
  if(length<1||length>62)return jsonError("A billing period must be between 1 and 62 days.",422);
  if(input.cycle==="MONTHLY"){
   const month=monthlyPeriods(Number(input.invoiceMonth.slice(0,4)))[Number(input.invoiceMonth.slice(5))-1];
   if(input.periodStart!==month.periodStart||input.periodEnd!==month.periodEnd)return jsonError("Monthly periods must cover the complete invoice month.",422);
  }
 }
 try{
  const events=inputs.some(input=>input.cycle==="LBE")?await englandBankHolidays():[];
  const rows=await prisma.$transaction(async tx=>{
   await tx.appSetting.upsert({where:{key:"billingRunLock"},update:{updatedBy:user.id},create:{key:"billingRunLock",value:true,updatedBy:user.id}});
   const results=[];
   for(const input of inputs){
    const existing=await tx.billingPeriod.findUnique({where:{cycle_invoiceMonth:{cycle:input.cycle,invoiceMonth:input.invoiceMonth}}});
    if("preset" in data&&existing){results.push(existing);continue;}
    if(existing&&existing.id!==input.id)throw Error("A period already exists for that billing group and invoice month. Edit it instead.");
    if(input.id&&await tx.billingRun.count({where:{billingPeriodId:input.id}}))throw Error("This period has invoice runs. Keep its dates for history and create a different period if needed.");
    const start=new Date(input.periodStart),end=new Date(input.periodEnd);
    const overlap=await tx.billingPeriod.findFirst({where:{cycle:input.cycle,...(input.id?{id:{not:input.id}}:{}),periodStart:{lte:end},periodEnd:{gte:start}}});
    if(overlap)throw Error(`These dates overlap ${overlap.label}.`);
    const values={label:input.label,cycle:input.cycle,invoiceMonth:input.invoiceMonth,periodStart:start,periodEnd:end,bankHolidayDates:input.cycle==="LBE"?holidaysInPeriod(events,input.periodStart,input.periodEnd):[],updatedById:user.id};
    const row=input.id?await tx.billingPeriod.update({where:{id:input.id},data:values}):await tx.billingPeriod.create({data:values});
    const task={title:`Billing due: ${row.label}`.slice(0,191),startDate:start,endDate:end,dueDate:end,owner:"Kellie",notes:`Prepare ${row.label} invoices. Confirm funded day counts, PO references and management removals.${row.cycle==="LBE"?" England bank holidays are deducted automatically.":""}`};
    await tx.operationalTask.upsert({where:{sourceKey:`billing-period:${row.id}`},update:task,create:{...task,sourceKey:`billing-period:${row.id}`,createdById:user.id}});
    results.push(row);
   }
   return results;
  });
  await audit("BILLING_PERIODS_SAVED",{actorType:"USER",actorId:user.id,afterValue:{periodIds:rows.map(row=>row.id)}});
  return NextResponse.json(rows);
 }catch(error){return jsonError(error instanceof Error?error.message:"Unable to save billing periods.",409);}
});}
