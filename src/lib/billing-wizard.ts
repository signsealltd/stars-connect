import {prisma} from "./prisma";
import {fundedRuleForDate,fundedCountAmounts,needsPurchaseOrder} from "./funded-days";
import {createHash} from "crypto";
export {manualInvoiceAmounts,needsAmendmentReason} from "./billing-total-rules";
export async function billingChoices(periodId:string){
 const period=await prisma.billingPeriod.findUnique({where:{id:periodId}});if(!period)throw Error("Choose a saved billing period.");
 const [students,profiles,invoices]=await Promise.all([
  prisma.student.findMany({where:{active:true,startDate:{lte:period.periodEnd},OR:[{endDate:null},{endDate:{gte:period.periodStart}}]},orderBy:{displayName:"asc"},select:{id:true,displayName:true,startDate:true}}),
  prisma.billingProfile.findMany({where:{activeFrom:{lte:period.periodEnd},OR:[{activeTo:null},{activeTo:{gte:period.periodStart}}]},include:{chargeRules:true}}),
  prisma.invoice.findMany({where:{status:"ISSUED",grossTotal:{gte:0},billingRun:{periodStart:period.periodStart,periodEnd:period.periodEnd}},orderBy:{createdAt:"desc"},select:{id:true,studentId:true,billingProfileId:true,invoiceNumber:true}})
 ]);
 const rows=students.flatMap(student=>{
  const matching=profiles.filter(p=>p.studentId===student.id),profile=matching[0];
  if(profile&&needsPurchaseOrder(`${profile.payerName} ${profile.fundingOrganisation||""}`)!==(period.cycle==="LBE"))return [];
  const effective=new Date(Math.max(period.periodStart.getTime(),student.startDate.getTime(),profile?.activeFrom.getTime()||0));
  const rule=profile?fundedRuleForDate(profile.chargeRules,effective):undefined;
  const holidays=period.cycle==="LBE"&&Array.isArray(period.bankHolidayDates)?period.bankHolidayDates.length:0;
  const amounts=rule&&rule.fundedDayCount!=null?fundedCountAmounts(Number(rule.fundedDayCount),holidays,0,Number(rule.rate),Number(rule.vatRate)):null;
  const error=!profile?"Add a payer and billing details.":matching.length>1?"More than one funding arrangement applies. Check Billing settings.":period.cycle==="LBE"&&!profile.purchaseOrderNumber?.trim()?"Add the client's PO reference.":!profile.billingAddress.trim()?"Add the payer's billing address.":null;
  return [{id:student.id,name:student.displayName,payer:profile?.payerName||"Not set",profileId:profile?.id||null,quantity:amounts?.quantity??null,rate:rule?Number(rule.rate):null,total:amounts?.grossAmount??null,vatRate:rule?Number(rule.vatRate):Number(profile?.vatRate||0),error,existing:invoices.find(i=>i.studentId===student.id&&i.billingProfileId===profile?.id)||null}];
 });
 const token=createHash("sha256").update(JSON.stringify({period,rows})).digest("hex");
 return {period,rows,token};
}
