export type Allocation = { id: string; fundedDayCount?: unknown; active: boolean; activeFrom: Date; activeTo: Date | null; applicableWeekdays: unknown; attendanceDependency: string; unitType: string; rate: unknown; vatRate: unknown };
export function dateKeys(from: Date, to: Date) {
  const days: Date[] = [];
  if (to < from || (to.getTime() - from.getTime()) / 86400000 > 366) throw new Error("Choose a billing period of no more than one year.");
  for (let time = from.getTime(); time <= to.getTime(); time += 86400000) days.push(new Date(time));
  return days;
}
export function fundedRuleForDate(rules: Allocation[], date: Date) {
  return rules.filter(rule => rule.active && rule.attendanceDependency === "FUNDED" && rule.activeFrom <= date && (!rule.activeTo || rule.activeTo >= date))
    .sort((a,b) => b.activeFrom.getTime() - a.activeFrom.getTime())[0];
}
export function allocatedOn(rule: Allocation, date: Date) {
  return Array.isArray(rule.applicableWeekdays) && rule.applicableWeekdays.includes(date.getUTCDay() || 7);
}
export const needsPurchaseOrder = (payer: string) => /\benfield\b|\bLBE\b/i.test(payer.trim());
export function fundedAmounts(rule: Allocation) {
  const quantity = rule.unitType === "HALF_DAY" ? 0.5 : 1;
  const unitRate = Number(rule.rate), vatRate = Number(rule.vatRate);
  if (![unitRate, vatRate].every(Number.isFinite) || unitRate < 0 || vatRate < 0 || vatRate > 100) throw new Error("Invalid funded rate");
  const netAmount = Math.round(quantity * unitRate * 100) / 100;
  const vatAmount = Math.round(netAmount * vatRate) / 100;
  return { quantity, unitRate, netAmount, vatRate, vatAmount, grossAmount: Math.round((netAmount + vatAmount) * 100) / 100 };
}

export function fundedCountAmounts(days:number,bankHolidays:number,removed:number,rate:number,vatRate:number){
 if(![days,bankHolidays,removed,rate,vatRate].every(Number.isFinite)||days<0||days>366||days*2%1||bankHolidays<0||!Number.isInteger(bankHolidays)||removed<0||removed*2%1||removed>Math.max(0,days-bankHolidays)||rate<0||vatRate<0||vatRate>100)throw new Error("Check funded days, holiday deductions, removals and rate.");
 const quantity=Math.max(0,days-bankHolidays-removed),netAmount=Math.round(quantity*rate*100)/100,vatAmount=Math.round(netAmount*vatRate)/100;
 return {quantity,unitRate:rate,netAmount,vatRate,vatAmount,grossAmount:Math.round((netAmount+vatAmount)*100)/100};
}
