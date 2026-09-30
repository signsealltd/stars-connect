import {Prisma} from "@prisma/client";
import {z} from "zod";
import {prisma} from "./prisma";
import {RequestError} from "./request-error";

export const invoiceDeletionSchema=z.object({invoiceIds:z.array(z.string().uuid()).min(1).max(100),reason:z.string().trim().min(3).max(500)});
export async function deleteInvoices(input:z.infer<typeof invoiceDeletionSchema>,actorId:string){
 return prisma.$transaction(async tx=>{
  // Share the payment lock and invoice lock order with payment mutations.
  await tx.appSetting.upsert({where:{key:"paymentTrackingLock"},create:{key:"paymentTrackingLock",value:0},update:{value:0}});
  const ids=[...new Set(input.invoiceIds)].sort();
  for(const id of ids)await tx.$queryRaw`SELECT id FROM Invoice WHERE id=${id} FOR UPDATE`;
  const invoices=await tx.invoice.findMany({where:{id:{in:ids}}});
  if(invoices.length!==ids.length)throw new RequestError("An invoice is unavailable. Refresh your selection; nothing was deleted.",409);
  const changed=invoices.filter(i=>i.status!=="DELETED");
  for(const invoice of changed){
   await tx.invoice.update({where:{id:invoice.id},data:{status:"DELETED",paymentRevision:{increment:1}}});
   await tx.auditLog.create({data:{action:"INVOICE_DELETED",actorType:"USER",actorId,entityType:"Invoice",entityId:invoice.id,beforeValue:{status:invoice.status,paymentState:invoice.paymentState,paymentRevision:invoice.paymentRevision,invoiceNumber:invoice.invoiceNumber,grossTotal:invoice.grossTotal.toString(),documentId:invoice.documentId},afterValue:{status:"DELETED",reason:input.reason}}});
  }
  // Retain old exports for audit, but never reuse them as current downloads.
  await tx.documentRecord.updateMany({where:{sourceType:"BillingRun",sourceId:{in:changed.map(i=>i.billingRunId)},documentType:{in:["INVOICE_ZIP","INVOICE_REGISTER_CSV"]},status:"GENERATED"},data:{status:"SUPERSEDED"}});
  return {deleted:changed.length};
 },{timeout:30000,isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
}
