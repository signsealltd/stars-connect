import { prisma } from "./prisma";
import { createHash } from "crypto";
import { fundedRuleForDate, needsPurchaseOrder, fundedCountAmounts } from "./funded-days";
import {monthlyPeriods} from "./billing-periods";

export async function calculateFundedRun(id:string){
 return prisma.$transaction(async tx=>{
  const claim=await tx.billingRun.updateMany({where:{id,status:{in:["DRAFT","REQUIRES_REVIEW","REVIEWED"]}},data:{updatedAt:new Date()}});
  if(!claim.count)throw Error("Create a new revision to recalculate a completed run.");
  const run=await tx.billingRun.findUniqueOrThrow({where:{id}});
  const selected=Array.isArray(run.selectedStudentIds)?run.selectedStudentIds.filter((v):v is string=>typeof v==="string"):[];
  const students=await tx.student.findMany({where:{...(selected.length?{id:{in:selected}}:{}),...(run.historicalMode?{}:{startDate:{lte:run.periodEnd},OR:[{endDate:null},{endDate:{gte:run.periodStart}}]})}});
  const profiles=await tx.billingProfile.findMany({where:{activeFrom:{lte:run.periodEnd},OR:[{activeTo:null},{activeTo:{gte:run.periodStart}}]},include:{chargeRules:true}});
  const previous=run.supersedesRunId?await tx.billingCharge.findMany({where:{billingRunId:run.supersedesRunId,manuallyAdjusted:true}}):[];
  const existing=await tx.billingCharge.findMany({where:{billingRunId:id,manuallyAdjusted:true}});
  const retained=new Map([...previous,...existing].filter(c=>c.chargeRuleId&&c.fundedDays!=null).map(c=>[`${c.studentId}:${c.billingProfileId}`,c]));
  await tx.billingCharge.deleteMany({where:{billingRunId:id,NOT:{manuallyAdjusted:true,chargeRuleId:null,sourceAttendanceId:null,exceptionCode:null}}});
  for(const student of students){
   const matching=profiles.filter(p=>p.studentId===student.id),profile=matching[0];
   const effective=new Date(Math.max(run.periodStart.getTime(),(run.historicalMode?run.periodStart:student.startDate).getTime(),profile?.activeFrom.getTime()||0));
   const rule=profile?fundedRuleForDate(profile.chargeRules,effective):undefined;
   const adjustment=profile?retained.get(`${student.id}:${profile.id}`):undefined;
   const count=adjustment?.fundedDays??rule?.fundedDayCount;
   const lbe=profile&&needsPurchaseOrder(`${profile.payerName} ${profile.fundingOrganisation||""}`);
   const bankHolidayDays=lbe&&Array.isArray(run.bankHolidayDates)?run.bankHolidayDates.length:0;
   const removedDays=Number(adjustment?.removedDays||0);
   const legacyRemoval=[...previous,...existing].some(c=>c.studentId===student.id&&c.chargeRuleId&&c.fundedDays==null&&c.excluded);
   const exceptionCode=!profile?"MISSING_BILLING_PROFILE":matching.length>1?"OVERLAPPING_FUNDING_PROFILES":!rule?"UNCONFIRMED_FUNDED_DAYS":lbe&&!run.billingPeriodId?"LBE_PERIOD_REQUIRED":count==null?"FUNDED_COUNT_REQUIRED":legacyRemoval&&!adjustment?"CONFIRM_PREVIOUS_REMOVALS":null;
   const amounts=rule&&count!=null?fundedCountAmounts(Number(count),bankHolidayDays,removedDays,Number(rule.rate),Number(rule.vatRate)):{quantity:0,unitRate:rule?Number(rule.rate):0,netAmount:0,vatRate:rule?Number(rule.vatRate):0,vatAmount:0,grossAmount:0};
   await tx.billingCharge.create({data:{billingRunId:id,billingProfileId:profile?.id||"MISSING",studentId:student.id,studentName:student.displayName,payerName:profile?.payerName||"Missing payer",sourceDate:run.periodStart,chargeRuleId:rule?.id,fundedDays:count==null?null:Number(count),bankHolidayDays,removedDays,...amounts,description:exceptionCode?`Confirm billing setup: ${exceptionCode.toLowerCase().replaceAll("_"," ")}`:`Agreed funded days: ${Number(count)} less ${bankHolidayDays} bank holidays and ${removedDays} management removals`,exceptionCode,excluded:adjustment?.excluded||false,manuallyAdjusted:!!adjustment,adjustmentReason:adjustment?.adjustmentReason}});
  }
  await tx.billingRun.update({where:{id},data:{status:"REQUIRES_REVIEW"}});
  return {ok:true};
 },{timeout:60000});
}

export async function prepareMonthlyBilling(now:Date,actorId:string){
 const month=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/London",year:"numeric",month:"2-digit"}).format(now);
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/London"}).format(now);
 const setting=await prisma.appSetting.findUnique({where:{key:"monthlyFundedBilling"}}),config=setting?.value as {enabled?:boolean;startMonth?:string}|null;
 if(!config?.enabled||!config.startMonth||month<config.startMonth)return null;
 const input=monthlyPeriods(Number(month.slice(0,4)))[Number(month.slice(5))-1];
 await prisma.billingPeriod.upsert({where:{cycle_invoiceMonth:{cycle:"MONTHLY",invoiceMonth:month}},update:{},create:{...input,periodStart:new Date(input.periodStart),periodEnd:new Date(input.periodEnd),bankHolidayDates:[],updatedById:actorId}});
 const periods=await prisma.billingPeriod.findMany({where:{periodStart:{lte:new Date(today)},periodEnd:{gte:new Date(today)}}});
 const runs=[];
 for(const period of periods){
  const profiles=await prisma.billingProfile.findMany({where:{activeFrom:{lte:period.periodEnd},OR:[{activeTo:null},{activeTo:{gte:period.periodStart}}]}});
  const studentIds=[...new Set(profiles.filter(p=>needsPurchaseOrder(`${p.payerName} ${p.fundingOrganisation||""}`)===(period.cycle==="LBE")).map(p=>p.studentId))];
  if(!studentIds.length)continue;
  const run=await prisma.$transaction(async tx=>{
   await tx.appSetting.upsert({where:{key:"billingRunLock"},update:{updatedBy:actorId},create:{key:"billingRunLock",value:true,updatedBy:actorId}});
   const existing=await tx.billingRun.findFirst({where:{billingPeriodId:period.id},orderBy:{version:"desc"}});if(existing)return existing;
   const previous=await tx.billingRun.findFirst({where:{periodStart:period.periodStart,periodEnd:period.periodEnd},orderBy:{version:"desc"}});
   return tx.billingRun.create({data:{requestKey:`automatic-period:${period.id}`,billingPeriodId:period.id,bankHolidayDates:period.bankHolidayDates!,periodStart:period.periodStart,periodEnd:period.periodEnd,label:period.label,selectedStudentIds:studentIds,createdById:actorId,notes:"Automatic funded-day preparation",version:(previous?.version||0)+1}});
  });
  if(run.status==="DRAFT")await calculateFundedRun(run.id);
  await createBillingTask(run.id,period.label,period.periodStart,period.periodEnd,actorId);
  runs.push(run);
 }
 return runs;
}
export async function createBillingTask(runId:string,payerName:string,start:Date,end:Date,actorId:string){
 const sourceKey=`billing:${runId}:${createHash("sha256").update(payerName).digest("hex").slice(0,24)}`;
 return prisma.operationalTask.upsert({where:{sourceKey},update:{},create:{sourceKey,title:`Billing: ${payerName}`.slice(0,191),startDate:start,endDate:end,dueDate:end,billingRunId:runId,createdById:actorId,owner:"Kellie",notes:"Confirm funded day counts, bank holiday deductions, management removals and client PO references before issuing invoices."}});
}
