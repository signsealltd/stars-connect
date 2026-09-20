import { prisma } from "./prisma";
import { createHash } from "crypto";
import { allocatedOn, dateKeys, fundedAmounts, fundedRuleForDate } from "./funded-days";

export async function calculateFundedRun(id: string) {
  return prisma.$transaction(async tx => {
    const claim=await tx.billingRun.updateMany({where:{id,status:{in:["DRAFT","REQUIRES_REVIEW","REVIEWED"]}},data:{updatedAt:new Date()}});
    if(!claim.count)throw new Error("Create a new revision to recalculate a completed run.");
    const run = await tx.billingRun.findUniqueOrThrow({ where: { id } });
    const selected=Array.isArray(run.selectedStudentIds)?run.selectedStudentIds.filter((v):v is string=>typeof v==="string"):[];
    const students = await tx.student.findMany({ where: { ...(selected.length?{id:{in:selected}}:{}), startDate: { lte: run.periodEnd }, OR: [{ endDate: null }, { endDate: { gte: run.periodStart } }] } });
    const profiles = await tx.billingProfile.findMany({ where: { activeFrom: { lte: run.periodEnd }, OR: [{ activeTo: null }, { activeTo: { gte: run.periodStart } }] }, include: { chargeRules: true } });
    const previous = run.supersedesRunId ? await tx.billingCharge.findMany({where:{billingRunId:run.supersedesRunId,manuallyAdjusted:true}}) : [];
    const existing = await tx.billingCharge.findMany({where:{billingRunId:id,manuallyAdjusted:true}});
    const key = (c: {studentId:string;billingProfileId:string;sourceDate:Date}) => `${c.studentId}:${c.billingProfileId}:${c.sourceDate.toISOString().slice(0,10)}`;
    const retained = new Map([...previous,...existing].filter(c=>c.chargeRuleId).map(c=>[key(c),c]));
    await tx.billingCharge.deleteMany({ where: { billingRunId: id, NOT: { manuallyAdjusted: true, chargeRuleId: null, sourceAttendanceId: null, exceptionCode: null } } });
    for (const student of students) {
      const matching = profiles.filter(p=>p.studentId===student.id);
      const exceptionDates = new Set<string>();
      for (const date of dateKeys(run.periodStart,run.periodEnd)) {
        if(date<student.startDate || (student.endDate && date>student.endDate) || (!student.active && student.archivedAt && date>student.archivedAt)) continue;
        const activeProfiles = matching.filter(p=>date>=p.activeFrom && (!p.activeTo || date<=p.activeTo));
        if(!activeProfiles.length&&matching.length)continue;
        const problem = !activeProfiles.length ? "MISSING_BILLING_PROFILE" : activeProfiles.length>1 ? "OVERLAPPING_FUNDING_PROFILES" : null;
        const profile = activeProfiles[0];
        const rule = profile ? fundedRuleForDate(profile.chargeRules,date) : undefined;
        const code = problem || (!rule ? "UNCONFIRMED_FUNDED_DAYS" : !["DAY","HALF_DAY"].includes(rule.unitType) ? "UNSUPPORTED_FUNDED_UNIT" : null);
        if(code) {
          if(exceptionDates.has(code)) continue;
          exceptionDates.add(code);
          await tx.billingCharge.create({data:{billingRunId:id,billingProfileId:profile?.id||"MISSING",studentId:student.id,studentName:student.displayName,payerName:profile?.payerName||"Missing payer",sourceDate:date,description:`Funding setup required: ${code.toLowerCase().replaceAll("_"," ")}`,quantity:0,unitRate:0,netAmount:0,vatRate:0,vatAmount:0,grossAmount:0,exceptionCode:code}});
          continue;
        }
        if(!rule || !allocatedOn(rule,date)) continue;
        const base = {billingRunId:id,billingProfileId:profile.id,studentId:student.id,studentName:student.displayName,payerName:profile.payerName,sourceDate:date,chargeRuleId:rule.id,description:"Agreed funded day",...fundedAmounts(rule)};
        const adjustment = retained.get(key(base));
        await tx.billingCharge.create({data:{...base,...(adjustment?{excluded:adjustment.excluded,manuallyAdjusted:true,adjustmentReason:adjustment.adjustmentReason}: {})}});
      }
    }
    await tx.billingRun.update({where:{id},data:{status:"REQUIRES_REVIEW"}});
    return {ok:true};
  },{timeout:60000});
}

export async function prepareMonthlyBilling(now: Date, actorId: string) {
  const month = new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/London",year:"numeric",month:"2-digit"}).format(now);
  const setting=await prisma.appSetting.findUnique({where:{key:"monthlyFundedBilling"}});
  const configuration=setting?.value as {enabled?:boolean;startMonth?:string}|null;
  if(!configuration?.enabled||!configuration.startMonth||month<configuration.startMonth)return null;
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0));
  const run=await prisma.$transaction(async tx=>{
    await tx.appSetting.upsert({where:{key:"billingRunLock"},update:{updatedBy:actorId},create:{key:"billingRunLock",value:true,updatedBy:actorId}});
    const existing=await tx.billingRun.findUnique({where:{requestKey:`automatic:${month}`}});
    if(existing)return existing;
    const previous=await tx.billingRun.findFirst({where:{periodStart:start,periodEnd:end},orderBy:{version:"desc"}});
    // A manually prepared month already fulfils automatic preparation.
    if(previous)return previous;
    return tx.billingRun.create({data:{requestKey:`automatic:${month}`,periodStart:start,periodEnd:end,createdById:actorId,notes:"Automatic monthly funded-day preparation",version:1}});
  });
  if(run.status==="DRAFT") await calculateFundedRun(run.id);
  const payers = await prisma.billingProfile.findMany({where:{activeFrom:{lte:end},OR:[{activeTo:null},{activeTo:{gte:start}}]},select:{payerName:true},distinct:["payerName"]});
  for(const payer of payers) await createBillingTask(run.id,payer.payerName,start,end,actorId);
  return run;
}

export async function createBillingTask(runId:string,payerName:string,start:Date,end:Date,actorId:string) {
 const sourceKey=`billing:${runId}:${createHash("sha256").update(payerName).digest("hex").slice(0,24)}`;
 return prisma.operationalTask.upsert({where:{sourceKey},update:{},create:{sourceKey,title:`Billing: ${payerName}`.slice(0,191),startDate:start,endDate:end,dueDate:end,billingRunId:runId,createdById:actorId,owner:"Kellie",notes:"Confirm funded days, rates, approved removals and client PO references before issuing invoices. Adjust the due date to the payer's agreed timetable."}});
}
