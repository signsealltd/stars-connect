import { Prisma } from "@prisma/client";
import { localDateAsDatabaseDate } from "./dates";
import type { z } from "zod";
import { inlineBillingSchema } from "./student-management";
export type InlineBilling = z.infer<typeof inlineBillingSchema>;
const ruleData = (b: InlineBilling) => ({chargeType:"FULL_DAY",description:"Agreed funded day",unitType:"DAY",rate:new Prisma.Decimal(b.rate),attendanceDependency:"FUNDED",applicableWeekdays:[...new Set(b.fundedDays)].sort(),activeFrom:localDateAsDatabaseDate(b.activeFrom),vatTreatment:b.vatTreatment,vatRate:new Prisma.Decimal(b.vatRate)});
export async function createInlineBillingProfile(tx:Prisma.TransactionClient,studentId:string,userId:string,b:InlineBilling,_registerDays:number[]) {
  void _registerDays;
  if(await tx.billingProfile.findFirst({where:{studentId,activeTo:null}})) throw new Error("ACTIVE_BILLING_PROFILE_EXISTS");
  return tx.billingProfile.create({data:{studentId,payerType:b.payerType,payerName:b.payerName,billingAddress:b.billingAddress,billingEmail:b.billingEmail||null,purchaseOrderNumber:b.purchaseOrderNumber||null,activeFrom:localDateAsDatabaseDate(b.activeFrom),vatTreatment:b.vatTreatment,vatRate:new Prisma.Decimal(b.vatRate),createdById:userId,chargeRules:{create:ruleData(b)}},include:{chargeRules:true}});
}
export async function updateInlineBillingProfile(tx:Prisma.TransactionClient,profileId:string,studentId:string,b:InlineBilling,_registerDays:number[]) {
  void _registerDays;
  const p=await tx.billingProfile.findFirst({where:{id:profileId,studentId},include:{chargeRules:true}});
  if(!p)throw new Error("BILLING_PROFILE_NOT_FOUND");
  const effective=localDateAsDatabaseDate(b.activeFrom);
  await tx.billingProfile.update({where:{id:profileId},data:{payerType:b.payerType,payerName:b.payerName,billingAddress:b.billingAddress,billingEmail:b.billingEmail||null,purchaseOrderNumber:b.purchaseOrderNumber||null,activeFrom:effective<p.activeFrom?effective:p.activeFrom,vatTreatment:b.vatTreatment,vatRate:new Prisma.Decimal(b.vatRate)}});
  const same=p.chargeRules.find(r=>r.active&&r.attendanceDependency==="FUNDED"&&r.activeFrom.getTime()===effective.getTime());
  const next=p.chargeRules.filter(r=>r.active&&r.attendanceDependency==="FUNDED"&&r.activeFrom>effective).sort((a,b)=>a.activeFrom.getTime()-b.activeFrom.getTime())[0];
  await tx.chargeRule.updateMany({where:{billingProfileId:profileId,attendanceDependency:"FUNDED",activeFrom:{lt:effective},OR:[{activeTo:null},{activeTo:{gte:effective}}]},data:{activeTo:new Date(effective.getTime()-86400000)}});
  const data={...ruleData(b),activeTo:next?new Date(next.activeFrom.getTime()-86400000):null};
  if(same)await tx.chargeRule.update({where:{id:same.id},data});
  else await tx.chargeRule.create({data:{...data,billingProfileId:profileId}});
  return tx.billingProfile.findUniqueOrThrow({where:{id:profileId},include:{chargeRules:{orderBy:{activeFrom:"desc"}}}});
}
