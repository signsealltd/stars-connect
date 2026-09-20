export function manualInvoiceAmounts(total:number,vatRate:number){
 if(!Number.isFinite(total)||total<=0||total>1000000||Math.abs(total*100-Math.round(total*100))>0.00001)throw Error("Enter a positive total with no more than two decimal places.");
 if(!Number.isFinite(vatRate)||vatRate<0||vatRate>100)throw Error("Check the VAT rate in Billing settings.");
 const netAmount=Math.round(total/(1+vatRate/100)*100)/100,vatAmount=Math.round((total-netAmount)*100)/100;
 return {quantity:1,unitRate:netAmount,netAmount,vatAmount,vatRate,grossAmount:total};
}
export function needsAmendmentReason(original:number|null,total:number){return original===null||Math.abs(total-original)>=Math.max(10,Math.abs(original)*0.05)}
