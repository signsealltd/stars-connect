import {needsPurchaseOrder} from "@/lib/funded-days";
import bcrypt from "bcryptjs";
import {Prisma} from "@prisma/client";
import {formatInTimeZone} from "date-fns-tz";
import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {audit} from "@/lib/audit";
import {requestContext} from "@/lib/api";
import {invoiceNumber} from "@/lib/billing";
import {APP_TIME_ZONE,localDateAsDatabaseDate} from "@/lib/dates";
import {simplePdf,storeDocument} from "@/lib/documents";
import {calculateInvoiceLines,calculateInvoiceTotals,invoiceReissueSchema} from "@/lib/invoice-reissue";
import {loadInvoiceLogo} from "@/lib/invoice-logo";
import {invoicePdf} from "@/lib/invoice-pdf";
import {CAPABILITIES,requireCapability} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {getBillingSettings} from "@/lib/billing-settings";

const creditNoteSchema=z.object({action:z.literal("credit-note"),reason:z.string().min(10).max(2000)});

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const actor=await requireCapability(CAPABILITIES.BILLING_APPROVE),{id}=await params,body=await req.json().catch(()=>null);
  const original=await prisma.invoice.findUnique({where:{id},include:{billingRun:true}});
  if(!original)return NextResponse.json({error:"Invoice not found."},{status:404});
  if(body?.action==="credit-note")return createCreditNote(req,actor.id,original,body);

  const parsed=invoiceReissueSchema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:"Check every invoice field, line value, correction reason and password."},{status:422});
  if(!await bcrypt.compare(parsed.data.password,actor.passwordHash))return NextResponse.json({error:"Your password was not accepted."},{status:401});
  if(original.status!=="ISSUED"||!original.documentId)return NextResponse.json({error:"Only an issued invoice with an existing document can be reissued."},{status:409});
  const oldDocument=await prisma.documentRecord.findUnique({where:{id:original.documentId}});
  if(!oldDocument)return NextResponse.json({error:"The original invoice document is unavailable, so no changes were made."},{status:409});
  const start=localDateAsDatabaseDate(parsed.data.periodStart),end=localDateAsDatabaseDate(parsed.data.periodEnd),invoiceDate=localDateAsDatabaseDate(parsed.data.invoiceDate),dueDate=localDateAsDatabaseDate(parsed.data.dueDate);
  if(end<start||dueDate<invoiceDate)return NextResponse.json({error:"Check the billing period and payment due dates."},{status:422});
  const profile=await prisma.billingProfile.findUnique({where:{id:original.billingProfileId}});
  const purchaseOrderNumber=original.purchaseOrderNumber||profile?.purchaseOrderNumber||undefined;
  if(needsPurchaseOrder(parsed.data.payerName)&&!purchaseOrderNumber?.trim())return NextResponse.json({error:"Add the client PO number to the billing profile before reissuing."},{status:422});
  const lines=calculateInvoiceLines(parsed.data.lines),totals=calculateInvoiceTotals(lines),nextVersion=original.version+1,settings=await getBillingSettings(),logoJpeg=await loadInvoiceLogo(settings.invoiceLogoUrl);
  const content=invoicePdf({logoJpeg,invoiceNumber:original.invoiceNumber,invoiceDate:formatInTimeZone(invoiceDate,APP_TIME_ZONE,"dd MMMM yyyy"),dueDate:formatInTimeZone(dueDate,APP_TIME_ZONE,"dd MMMM yyyy"),periodLabel:`${formatInTimeZone(start,APP_TIME_ZONE,"dd MMM yyyy")} - ${formatInTimeZone(end,APP_TIME_ZONE,"dd MMM yyyy")}`,supplierName:parsed.data.supplierName,supplierAddress:parsed.data.supplierAddress.split(/\r?\n/),companyNumber:parsed.data.companyNumber,vatNumber:parsed.data.vatNumber,payerName:parsed.data.payerName,payerAddress:parsed.data.payerAddress.split(/\r?\n/),studentName:parsed.data.studentName,studentReference:parsed.data.studentReference,purchaseOrderNumber,rows:lines.map(line=>({date:line.date,service:line.service,days:line.quantity.toFixed(2),rate:`GBP ${line.unitRate.toFixed(2)}`,net:`GBP ${line.net.toFixed(2)}`,vat:`GBP ${line.vat.toFixed(2)}`,total:`GBP ${line.total.toFixed(2)}`})),attendanceDays:lines.reduce((sum,line)=>sum+line.quantity,0).toFixed(2),dayRate:new Set(lines.map(line=>line.unitRate.toFixed(2))).size===1?`GBP ${lines[0].unitRate.toFixed(2)}`:"Varied",netTotal:`GBP ${totals.net.toFixed(2)}`,vatTotal:`GBP ${totals.vat.toFixed(2)}`,grossTotal:`GBP ${totals.gross.toFixed(2)}`,paymentTerms:parsed.data.paymentTerms,bankDetails:parsed.data.bankDetails.split(/\r?\n/),remittanceInstructions:parsed.data.remittanceInstructions.split(/\r?\n/),approvedAt:original.billingRun.approvedAt?formatInTimeZone(original.billingRun.approvedAt,APP_TIME_ZONE,"dd MMMM yyyy HH:mm"):"Not recorded",generatedAt:formatInTimeZone(new Date(),APP_TIME_ZONE,"dd MMMM yyyy HH:mm")});
  const document=await storeDocument({documentNumber:oldDocument.documentNumber,documentType:"INVOICE",periodStart:start,periodEnd:end,version:oldDocument.version+1,createdById:actor.id,approvedById:actor.id,approvedAt:new Date(),generationSource:"ADMINISTRATOR",sourceType:"Invoice",sourceId:original.id,revisionReason:parsed.data.reason,mimeType:"application/pdf",content});
  const snapshot={...parsed.data,password:undefined,reason:undefined,lines:parsed.data.lines} as unknown as Prisma.InputJsonValue;
  await prisma.$transaction(async tx=>{
    await tx.documentRecord.update({where:{id:oldDocument.id},data:{status:"SUPERSEDED"}});
    await tx.documentRecord.update({where:{id:document.id},data:{supersededDocumentId:oldDocument.id}});
    await tx.documentRecord.updateMany({where:{sourceType:"BillingRun",sourceId:original.billingRunId,documentType:{in:["INVOICE_ZIP","INVOICE_REGISTER_CSV"]}},data:{status:"SUPERSEDED"}});
    await tx.invoice.update({where:{id},data:{purchaseOrderNumber,studentName:parsed.data.studentName.slice(0,120),version:nextVersion,documentId:document.id,invoiceDate,dueDate,payerName:parsed.data.payerName,netTotal:new Prisma.Decimal(totals.net),vatTotal:new Prisma.Decimal(totals.vat),grossTotal:new Prisma.Decimal(totals.gross),reissueData:snapshot}});
  });
  await audit("INVOICE_REISSUED",{actorType:"USER",actorId:actor.id,entityType:"Invoice",entityId:id,beforeValue:{version:original.version,documentId:oldDocument.id,net:Number(original.netTotal),vat:Number(original.vatTotal),gross:Number(original.grossTotal)},afterValue:{version:nextVersion,documentId:document.id,net:totals.net,vat:totals.vat,gross:totals.gross,reason:parsed.data.reason,lineCount:lines.length},...requestContext(req)});
  return NextResponse.json({ok:true,version:nextVersion,documentId:document.id,totals});
}

async function createCreditNote(req:NextRequest,actorId:string,original:Prisma.InvoiceGetPayload<{include:{billingRun:true}}>,body:unknown){
  const parsed=creditNoteSchema.safeParse(body);
  if(!parsed.success||original.status!=="ISSUED")return NextResponse.json({error:"Only issued invoices can be credited and a reason is required."},{status:422});
  const number=invoiceNumber(`${process.env.INVOICE_PREFIX||"STARS"}-CN`,new Date().getFullYear(),(await prisma.invoice.count())+1);
  const credit=await prisma.invoice.create({data:{billingRunId:original.billingRunId,invoiceNumber:number,status:"ISSUED",payerName:original.payerName,billingProfileId:original.billingProfileId,studentId:original.studentId,invoiceDate:new Date(),dueDate:new Date(),netTotal:original.netTotal.negated(),vatTotal:original.vatTotal.negated(),grossTotal:original.grossTotal.negated(),issuedAt:new Date(),supersedesId:original.id}});
  const document=await storeDocument({documentNumber:number,documentType:"CREDIT_NOTE",periodStart:original.billingRun.periodStart,periodEnd:original.billingRun.periodEnd,version:1,createdById:actorId,generationSource:"ADMINISTRATOR",sourceType:"Invoice",sourceId:credit.id,revisionReason:parsed.data.reason,mimeType:"application/pdf",content:simplePdf(`CREDIT NOTE ${number}`,[`Original invoice: ${original.invoiceNumber}`,`Payer: ${original.payerName}`,`Reason: ${parsed.data.reason}`,`Net credit: GBP ${original.netTotal.toFixed(2)}`,`VAT credit: GBP ${original.vatTotal.toFixed(2)}`,`Total credit: GBP ${original.grossTotal.toFixed(2)}`,"Page 1 of 1"])});
  await prisma.invoice.update({where:{id:credit.id},data:{documentId:document.id}});
  await audit("INVOICE_CREDIT_NOTE_GENERATED",{actorType:"USER",actorId,entityType:"Invoice",entityId:credit.id,afterValue:{originalInvoiceId:original.id,reason:parsed.data.reason},...requestContext(req)});
  return NextResponse.json({...credit,documentId:document.id},{status:201});
}
