import {createHash} from "crypto";
import {prisma} from "./prisma";
import {getBillingSettings} from "./billing-settings";
import {loadInvoiceLogo} from "./invoice-logo";
import {invoicePdf} from "./invoice-pdf";
import {invoiceNumber} from "./billing";
import {storeDocument,deleteStoredDocument} from "./documents";
import {studentFullName} from "./student-name";
import {calculateInvoiceLines,calculateInvoiceTotals} from "./invoice-reissue";
import {RequestError} from "./request-error";
import type {ManualInvoiceInput} from "./manual-invoice";

export async function issueManualInvoice(submitted:ManualInvoiceInput,actorId:string){
  const settings=await getBillingSettings(),logoJpeg=await loadInvoiceLogo(settings.invoiceLogoUrl);
  const signature=createHash("sha256").update(JSON.stringify(submitted)).digest("hex"),requestKey=`manual:${submitted.requestKey}`;
  let stored:{id:string;storagePath:string}|undefined;
  try{return await prisma.$transaction(async tx=>{
    // Use the shared sequence lock for all invoice writers, including retries.
    const counter=await tx.appSetting.upsert({where:{key:"invoiceSequence"},create:{key:"invoiceSequence",value:0,updatedBy:actorId},update:{updatedBy:actorId}});
    const existing=await tx.billingRun.findUnique({where:{requestKey},include:{invoices:true}});
    if(existing){if(existing.createdById!==actorId||existing.notes!==signature)throw new RequestError("This request has already been used. Refresh before creating another invoice.",409);return existing.invoices[0];}
    const student=await tx.student.findUnique({where:{id:submitted.studentId}}),profile=await tx.billingProfile.findFirst({where:{id:submitted.profileId,studentId:submitted.studentId}});
    if(!student||!profile)throw new RequestError("Choose a client with saved billing details.");
    if(profile.updatedAt.toISOString()!==submitted.profileVersion)throw new RequestError("Saved payer details changed. Refresh and review the invoice again.",409);
    const input={...submitted,payerName:profile.payerName,payerAddress:profile.billingAddress,purchaseOrderNumber:profile.purchaseOrderNumber||""};
    const start=new Date(input.periodStart),end=new Date(input.periodEnd),now=new Date();
    await tx.appSetting.upsert({where:{key:"billingRunLock"},create:{key:"billingRunLock",value:true,updatedBy:actorId},update:{updatedBy:actorId}});
    const latest=await tx.billingRun.findFirst({where:{periodStart:start,periodEnd:end},orderBy:{version:"desc"}});
    const lines=calculateInvoiceLines(input.lines),totals=calculateInvoiceTotals(lines);
    const run=await tx.billingRun.create({data:{requestKey,notes:signature,label:`Manual invoice · ${student.displayName}`.slice(0,191),periodStart:start,periodEnd:end,version:(latest?.version||0)+1,status:"INVOICES_GENERATED",selectedStudentIds:[student.id],createdById:actorId,approvedById:actorId,approvedAt:now,lockedAt:now}});
    let sequence=Math.max(Number(counter.value)||0,await tx.invoice.count()),number=invoiceNumber(settings.invoicePrefix,Number(input.invoiceDate.slice(0,4)),++sequence);
    while(await tx.invoice.findUnique({where:{invoiceNumber:number}}))number=invoiceNumber(settings.invoicePrefix,Number(input.invoiceDate.slice(0,4)),++sequence);
    const snapshot={...input,supplierName:settings.organisationLegalName,supplierAddress:settings.organisationAddress,companyNumber:settings.companyNumber,vatNumber:settings.vatNumber,studentName:studentFullName(student),studentReference:student.internalReference||"",paymentTerms:settings.defaultPaymentTerms,bankDetails:settings.bankDetails,remittanceInstructions:settings.remittanceInstructions};
    const invoice=await tx.invoice.create({data:{billingRunId:run.id,invoiceNumber:number,status:"ISSUED",billingProfileId:profile.id,studentId:student.id,studentName:studentFullName(student).slice(0,120),payerName:input.payerName,purchaseOrderNumber:input.purchaseOrderNumber||null,invoiceDate:new Date(input.invoiceDate),dueDate:new Date(input.dueDate),netTotal:totals.net,vatTotal:totals.vat,grossTotal:totals.gross,issuedAt:now,reissueData:snapshot}});
    await tx.billingCharge.createMany({data:lines.map(l=>({billingRunId:run.id,billingProfileId:profile.id,studentId:student.id,studentName:studentFullName(student).slice(0,120),payerName:input.payerName,sourceDate:start,description:l.service,quantity:l.quantity,unitRate:l.unitRate,netAmount:l.net,vatRate:l.vatRate,vatAmount:l.vat,grossAmount:l.total,manuallyAdjusted:true,adjustmentReason:"Custom invoice line entered and reviewed by issuer"}))});
    const date=(d:string)=>d.split("-").reverse().join("/"),money=(n:number)=>`GBP ${n.toFixed(2)}`;
    stored=await storeDocument({documentNumber:number,documentType:"INVOICE",periodStart:start,periodEnd:end,version:1,createdById:actorId,approvedById:actorId,approvedAt:now,generationSource:"MANAGER",sourceType:"Invoice",sourceId:invoice.id,mimeType:"application/pdf",content:invoicePdf({logoJpeg,invoiceNumber:number,invoiceDate:date(input.invoiceDate),dueDate:date(input.dueDate),periodLabel:`${date(input.periodStart)} - ${date(input.periodEnd)}`,supplierName:snapshot.supplierName,supplierAddress:snapshot.supplierAddress.split(/\r?\n/),companyNumber:snapshot.companyNumber,vatNumber:snapshot.vatNumber,payerName:input.payerName,payerAddress:input.payerAddress.split(/\r?\n/),studentName:snapshot.studentName,studentReference:snapshot.studentReference,purchaseOrderNumber:input.purchaseOrderNumber,rows:lines.map(l=>({date:l.date,service:l.service,days:String(l.quantity),rate:money(l.unitRate),net:money(l.net),vat:money(l.vat),total:money(l.total)})),attendanceDays:"",dayRate:"Varied",netTotal:money(totals.net),vatTotal:money(totals.vat),grossTotal:money(totals.gross),paymentTerms:snapshot.paymentTerms,bankDetails:snapshot.bankDetails.split(/\r?\n/),remittanceInstructions:snapshot.remittanceInstructions.split(/\r?\n/),approvedAt:now.toISOString(),generatedAt:now.toISOString()})});
    await tx.appSetting.update({where:{key:"invoiceSequence"},data:{value:sequence}});
    await tx.auditLog.create({data:{action:"MANUAL_INVOICE_ISSUED",actorType:"USER",actorId,entityType:"Invoice",entityId:invoice.id,afterValue:{invoiceNumber:number,studentId:student.id,lineCount:lines.length,...totals}}});
    return tx.invoice.update({where:{id:invoice.id},data:{documentId:stored.id}});
  },{timeout:60000});}catch(error){if(stored){await prisma.documentRecord.deleteMany({where:{id:stored.id}});await deleteStoredDocument(stored.storagePath);}throw error;}
}
