import {studentFullName} from "./student-name";
import { prisma } from "./prisma";
import { needsPurchaseOrder } from "./funded-days";
import { getBillingSettings } from "./billing-settings";
import { loadInvoiceLogo, safeDocumentName } from "./invoice-logo";
import { invoicePdf } from "./invoice-pdf";
import { storeDocument, deleteStoredDocument } from "./documents";
import { invoiceNumber } from "./billing";
import { audit } from "./audit";

export async function generateFundedInvoices(id:string,actorId:string,options?:{expectedPrevious:Record<string,string|null>}) {
  const settings=await getBillingSettings(),logoJpeg=await loadInvoiceLogo(settings.invoiceLogoUrl);
  const stored:Array<{id:string;storagePath:string}>=[];
  const result=await prisma.$transaction(async tx=>{
    // Lock numbering before any snapshot reads; concurrent replacement runs
    // must see the invoice issued by the previous transaction.
    const counter=await tx.appSetting.upsert({where:{key:"invoiceSequence"},update:{updatedBy:actorId},create:{key:"invoiceSequence",value:0,updatedBy:actorId}});
    const claim=await tx.billingRun.updateMany({where:{id,status:"LOCKED"},data:{status:"GENERATING"}});
    if(!claim.count) {
      const existing=await tx.billingRun.findUniqueOrThrow({where:{id},include:{invoices:true}});
      if(existing.status==="INVOICES_GENERATED")return existing.invoices;
      throw new Error("Approve and lock this run first. To generate again, create a new revision.");
    }
    const run=await tx.billingRun.findUniqueOrThrow({where:{id},include:{charges:true}});
    const charges=run.charges;
    if(!charges.length||charges.some(c=>!c.excluded&&c.exceptionCode))throw new Error("Resolve funding setup warnings before generating.");
    const profiles=await tx.billingProfile.findMany({where:{id:{in:[...new Set(charges.map(c=>c.billingProfileId))]}}});
    for(const p of profiles)if(needsPurchaseOrder(`${p.payerName} ${p.fundingOrganisation||""}`)&&!p.purchaseOrderNumber?.trim())throw new Error(`PO number required for ${p.payerName}. Update the student billing profile.`);
    // One database row serializes number allocation across different runs.
    let sequence=Math.max(Number(counter.value)||0,await tx.invoice.count());
    const groups=new Map<string,typeof charges>();
    for(const c of charges){const key=`${c.billingProfileId}:${c.studentId}`;groups.set(key,[...(groups.get(key)||[]),c]);}
    const output=[];
    const date=(d:Date)=>d.toLocaleDateString("en-GB",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"});
    const money=(n:number)=>`GBP ${n.toFixed(2)}`;
    for(const group of groups.values()) {
      const p=profiles.find(p=>p.id===group[0].billingProfileId)!;
      const student=await tx.student.findUniqueOrThrow({where:{id:group[0].studentId}});
      const previous=await tx.invoice.findFirst({where:{studentId:student.id,billingProfileId:p.id,status:"ISSUED",grossTotal:{gte:0},billingRun:{periodStart:run.periodStart,periodEnd:run.periodEnd}},orderBy:{createdAt:"desc"}});
      if(options&&(previous?.id||null)!==options.expectedPrevious[student.id])throw Error(`${student.displayName}: another invoice was created for this period. Refresh and review before replacing it.`);
      const included=group.filter(c=>!c.excluded);
      const net=included.reduce((sum,c)=>sum+Number(c.netAmount),0),vat=included.reduce((sum,c)=>sum+Number(c.vatAmount),0);
      const days=included.reduce((sum,c)=>sum+Number(c.quantity),0);
      let number=invoiceNumber(settings.invoicePrefix,new Date().getFullYear(),++sequence);
      while(await tx.invoice.findUnique({where:{invoiceNumber:number}}))number=invoiceNumber(settings.invoicePrefix,new Date().getFullYear(),++sequence);
      const now=new Date(),due=new Date(now.getTime()+p.paymentTermsDays*86400000);
      const invoice=await tx.invoice.create({data:{billingRunId:id,invoiceNumber:number,payerName:p.payerName,billingProfileId:p.id,studentId:student.id,studentName:studentFullName(student),purchaseOrderNumber:p.purchaseOrderNumber,invoiceDate:now,dueDate:due,netTotal:net,vatTotal:vat,grossTotal:net+vat,status:"ISSUED",issuedAt:now,version:(previous?.version||0)+1,supersedesId:previous?.id}});
      const period=`${date(run.periodStart)} - ${date(run.periodEnd)}`;
      const doc=await storeDocument({documentNumber:`${number}-${safeDocumentName(studentFullName(student))}`,documentType:"INVOICE",periodStart:run.periodStart,periodEnd:run.periodEnd,version:invoice.version,createdById:actorId,approvedById:run.approvedById||undefined,approvedAt:run.approvedAt||undefined,generationSource:"MANAGER",sourceType:"Invoice",sourceId:invoice.id,mimeType:"application/pdf",content:invoicePdf({logoJpeg,invoiceNumber:number,invoiceDate:date(now),dueDate:date(due),periodLabel:period,supplierName:settings.organisationLegalName,supplierAddress:settings.organisationAddress.split(/\r?\n/),companyNumber:settings.companyNumber,vatNumber:settings.vatNumber,payerName:p.payerName,payerAddress:p.billingAddress.split(/\r?\n/),studentName:studentFullName(student),studentReference:student.internalReference||"Not supplied",purchaseOrderNumber:p.purchaseOrderNumber||undefined,rows:[{date:period,service:"Day service",days:days.toFixed(2),rate:new Set(group.map(c=>String(c.unitRate))).size===1?money(Number(group[0].unitRate)):"Varied",net:money(net),vat:money(vat),total:money(net+vat)}],attendanceDays:days.toFixed(2),dayRate:new Set(group.map(c=>String(c.unitRate))).size===1?money(Number(group[0].unitRate)):"Varied",netTotal:money(net),vatTotal:money(vat),grossTotal:money(net+vat),paymentTerms:settings.defaultPaymentTerms,bankDetails:settings.bankDetails.split(/\r?\n/),remittanceInstructions:settings.remittanceInstructions.split(/\r?\n/),approvedAt:run.approvedAt?.toISOString()||"",generatedAt:now.toISOString()})});
      stored.push({id:doc.id,storagePath:doc.storagePath});
      await tx.invoice.update({where:{id:invoice.id},data:{documentId:doc.id}});
      if(previous)await tx.invoice.update({where:{id:previous.id},data:{status:"SUPERSEDED"}});
      output.push({...invoice,documentId:doc.id});
    }
    await tx.appSetting.update({where:{key:"invoiceSequence"},data:{value:sequence}});
    await tx.billingRun.update({where:{id},data:{status:"INVOICES_GENERATED"}});
    return output;
  },{timeout:60000}).catch(async error=>{
    // Documents are written outside the database transaction. Remove staged
    // outputs on rollback so a retry can reuse its unissued invoice number.
    for(const doc of stored){await prisma.documentRecord.deleteMany({where:{id:doc.id}});await deleteStoredDocument(doc.storagePath);}
    throw error;
  });
  await audit("FUNDED_INVOICES_GENERATED",{actorType:"USER",actorId:actorId,entityType:"BillingRun",entityId:id,afterValue:{count:result.length}});
  return result;
}
