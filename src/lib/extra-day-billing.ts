import {manualInvoiceAmounts,invoiceDayAmounts} from "./billing-total-rules";
import {fundedRuleForDate,fundedCountAmounts,type Allocation} from "./funded-days";
export function extraDayAmounts(rules:Allocation[],date:Date){
 const rule=fundedRuleForDate(rules,date);
 if(!rule||rule.unitType!=="DAY")throw Error("Confirm the agreed day rate for extra attendance on "+date.toISOString().slice(0,10));
 return {rule,amounts:fundedCountAmounts(1,0,0,Number(rule.rate),Number(rule.vatRate))};
}
export const extraDayWhere=(from:Date,to:Date)=>({extraDay:true,date:{gte:from,lte:to},status:{in:["PRESENT","LATE","OFFSITE"] as ("PRESENT"|"LATE"|"OFFSITE")[]}});

export function invoiceBaseAmounts(total:number,days:number|undefined,extraTotal:number,extraDays:number,rate:number,vatRate:number){
 const baseTotal=Math.round((total-extraTotal)*100)/100,baseDays=days===undefined?undefined:days-extraDays;
 if(baseTotal<0||(baseDays!==undefined&&baseDays<0))throw Error("The invoice cannot be less than its recorded extra days. Review extra attendance first.");
 const amounts=baseDays===0||baseDays===undefined&&baseTotal===0?fundedCountAmounts(0,0,0,rate,vatRate):baseDays===undefined?manualInvoiceAmounts(baseTotal,vatRate):invoiceDayAmounts(baseDays,rate,vatRate);
 if(baseDays!==undefined&&Math.abs(amounts.grossAmount-baseTotal)>0.001)throw Error("The days and total do not match. Refresh and review.");
 return amounts;
}
