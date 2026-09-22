import {Prisma, type Invoice} from "@prisma/client";
import {createHash} from "node:crypto";
import {z} from "zod";
import {prisma} from "./prisma";
import {localDateKey} from "./dates";

export const ignoreReasons=["Predates payment tracking","Cancelled outside STARS Connect","Duplicate historic record","Not being tracked under the new process","Other"] as const;
export const paymentActionSchema=z.object({
 action:z.enum(["PAY","IGNORE","RESTORE","REVERSE"]),
 items:z.array(z.object({id:z.string().uuid(),revision:z.number().int().nonnegative()})).min(1).max(100),
 receivedDate:z.string().date().optional(),amount:z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).optional(),
 reference:z.string().trim().max(191).optional(),notes:z.string().trim().max(1000).optional(),reason:z.string().trim().max(191).optional(),
}).superRefine((value,ctx)=>{
 if(new Set(value.items.map(i=>i.id)).size!==value.items.length)ctx.addIssue({code:"custom",message:"Select each invoice only once."});
 if(value.action==="PAY"&&(!value.receivedDate||value.receivedDate>localDateKey()))ctx.addIssue({code:"custom",path:["receivedDate"],message:"Enter a received date no later than today."});
 if(value.action==="PAY"&&value.items.length===1&&!value.amount)ctx.addIssue({code:"custom",path:["amount"],message:"Enter the amount received."});
 if(value.action==="IGNORE"&&(!ignoreReasons.includes(value.reason as typeof ignoreReasons[number])||(value.reason==="Other"&&!value.notes)))ctx.addIssue({code:"custom",path:["reason"],message:"Choose an ignore reason and explain Other."});
 if(value.action==="REVERSE"&&(!value.reason||value.reason.length<3))ctx.addIssue({code:"custom",path:["reason"],message:"Enter a reason for reversing the payment."});
});
export type PaymentAction=z.infer<typeof paymentActionSchema>;
export type TrackingSettings={startDate:string;actorId:string;actorName:string;confirmedAt:string};
type Db=Prisma.TransactionClient;
const KEY="paymentTracking";
export class PaymentError extends Error {constructor(message:string,public status=409){super(message)}}
export async function trackingSettings(db:Db=prisma){const row=await db.appSetting.findUnique({where:{key:KEY}});return (row?.value as TrackingSettings|null)??null}
// One organisation per database, matching the existing billing/session scope. No caller-supplied organisation identifier.
export async function paymentInvoices(db:Db=prisma){return db.invoice.findMany({where:{status:{in:["ISSUED","VOID","SUPERSEDED"]},grossTotal:{gt:0}},include:{billingRun:{select:{label:true,billingPeriodId:true,periodStart:true,periodEnd:true}},paymentEvents:{orderBy:{revision:"desc"}}}})}
export function effectivePaymentState(invoice:Pick<Invoice,"status"|"paymentState"|"issuedAt"|"createdAt">,settings:TrackingSettings|null,balance:Prisma.Decimal){
 if(invoice.paymentState==="PAID")return "PAID";
 if(invoice.status!=="ISSUED"||balance.lte(0))return "IGNORED";
 if(invoice.paymentState==="IGNORED"||invoice.paymentState==="OUTSTANDING")return invoice.paymentState;
 if(!settings)return "UNCONFIGURED";
 return localDateKey(invoice.issuedAt||invoice.createdAt)<settings.startDate?"IGNORED":"OUTSTANDING";
}
async function credits(db:Db){const rows=await db.invoice.findMany({where:{status:"ISSUED",grossTotal:{lt:0},supersedesId:{not:null}},select:{supersedesId:true,grossTotal:true}});const map=new Map<string,Prisma.Decimal>();for(const r of rows)map.set(r.supersedesId!, (map.get(r.supersedesId!)||new Prisma.Decimal(0)).plus(r.grossTotal));return map}
export async function paymentSnapshot(db:Db=prisma){
 const [settings,invoices,creditMap]=await Promise.all([trackingSettings(db),paymentInvoices(db),credits(db)]);
 const today=localDateKey();
 const rows=invoices.map(invoice=>{
  const balance=Prisma.Decimal.max(0,invoice.grossTotal.plus(creditMap.get(invoice.id)||0));
  const state=effectivePaymentState(invoice,settings,balance),event=invoice.paymentEvents[0];
  const lifecycle=invoice.status!=="ISSUED"?`Invoice ${invoice.status.toLowerCase()}`:balance.lte(0)?"Fully credited":null;
  const reason=lifecycle||(invoice.paymentState==="AUTO"?"Predates payment tracking":event?.reason)||"Ignored";
  return {id:invoice.id,revision:invoice.paymentRevision,state,invoiceNumber:invoice.invoiceNumber,client:invoice.studentName||"Historic client",clientId:invoice.studentId,payer:invoice.payerName,invoiceDate:invoice.invoiceDate.toISOString().slice(0,10),dueDate:invoice.dueDate.toISOString().slice(0,10),amount:invoice.grossTotal.toFixed(2),balance:balance.toFixed(2),documentId:invoice.documentId,periodId:invoice.billingRun.billingPeriodId,periodLabel:invoice.billingRun.label||`${invoice.billingRun.periodStart.toISOString().slice(0,10)} – ${invoice.billingRun.periodEnd.toISOString().slice(0,10)}`,runId:invoice.billingRunId,overdue:state==="OUTSTANDING"&&invoice.dueDate.toISOString().slice(0,10)<today,reason,actor:lifecycle&&state!=="PAID"?"System — invoice lifecycle":event?.actorName||settings?.actorName||"System",actionAt:lifecycle&&state!=="PAID"?invoice.updatedAt.toISOString():event?.createdAt.toISOString()||settings?.confirmedAt,receivedDate:event?.receivedDate?.toISOString().slice(0,10),receivedAmount:event?.amount?.toFixed(2),reference:event?.reference,notes:event?.notes,canRestore:!lifecycle,history:invoice.paymentEvents.map(e=>({...e,amount:e.amount?.toFixed(2)}))};
 });
 const outstanding=rows.filter(r=>r.state==="OUTSTANDING"),paid=rows.filter(r=>r.state==="PAID"&&r.receivedDate?.startsWith(today.slice(0,7)));
 return {settings,rows,summary:{outstandingCount:outstanding.length,outstandingTotal:sum(outstanding.map(r=>r.balance)),paidCount:paid.length,paidTotal:sum(paid.map(r=>r.receivedAmount||"0")),ignoredCount:rows.filter(r=>r.state==="IGNORED").length}};
}
export function sum(values:string[]){return values.reduce((s,v)=>s.plus(v),new Prisma.Decimal(0)).toFixed(2)}
export type PaymentRow=Awaited<ReturnType<typeof paymentSnapshot>>["rows"][number];
export function filterPayments(rows:PaymentRow[],q:URLSearchParams){
 const contains=(value:string,search:string|null)=>!search||value.toLowerCase().includes(search.toLowerCase());
 const range=(value:string|undefined,from:string|null,to:string|null)=>(!from||!!value&&value>=from)&&(!to||!!value&&value<=to);
 return rows.filter(r=>r.state===(q.get("tab")||"OUTSTANDING")&&contains(`${r.client} ${r.payer} ${r.invoiceNumber}`,q.get("search"))&&contains(r.client,q.get("client"))&&contains(r.payer,q.get("payer"))&&(!q.get("period")||r.runId===q.get("period"))&&range(r.invoiceDate,q.get("from"),q.get("to"))&&range(r.receivedDate,q.get("receivedFrom"),q.get("receivedTo"))&&(!q.get("reason")||r.reason===q.get("reason"))&&(!q.get("due")||(q.get("due")==="overdue"?r.overdue:!r.overdue)))
 .sort((a,b)=>Number(b.overdue)-Number(a.overdue)||a.dueDate.localeCompare(b.dueDate)||a.invoiceDate.localeCompare(b.invoiceDate)||a.id.localeCompare(b.id));
}
async function lock(db:Db){await db.appSetting.upsert({where:{key:"paymentTrackingLock"},create:{key:"paymentTrackingLock",value:0},update:{value:0}})}
function json(value:unknown){return value==null?Prisma.JsonNull:JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue}
async function log(db:Db,action:string,actor:{id:string;name:string},before:unknown,after:unknown,invoiceId?:string){await db.auditLog.create({data:{action,actorType:"USER",actorId:actor.id,entityType:invoiceId?"Invoice":"PaymentTracking",entityId:invoiceId,beforeValue:json(before),afterValue:json(after)}})}
export async function mutatePayments(input:PaymentAction,actor:{id:string;name:string}){
 return prisma.$transaction(async db=>{
  await lock(db);const settings=await trackingSettings(db);if(!settings)throw new PaymentError("Set up payment tracking first.");
  const ids=input.items.map(i=>i.id).sort();
  // Lock in a stable order, shared with invoice corrections/credits/replacements.
  for(const id of ids)await db.$queryRaw`SELECT id FROM Invoice WHERE id=${id} FOR UPDATE`;
  const snapshot=await paymentSnapshot(db),changed=[];
  for(const item of input.items){
   const row=snapshot.rows.find(r=>r.id===item.id);
   if(!row||row.revision!==item.revision)throw new PaymentError(`${row?.invoiceNumber||item.id}: changed or unavailable. Refresh and retry. Nothing was saved.`);
   const expected=input.action==="RESTORE"?"IGNORED":input.action==="REVERSE"?"PAID":"OUTSTANDING";
   if(row.state!==expected||(input.action==="RESTORE"&&!row.canRestore))throw new PaymentError(`${row.invoiceNumber}: this action is no longer available. Nothing was saved.`);
   if(input.action==="PAY"&&input.items.length===1&&!new Prisma.Decimal(input.amount!).equals(row.balance))throw new PaymentError("The received amount must match the full invoice balance. Partial payments are not supported yet.",422);
   const state=input.action==="PAY"?"PAID":input.action==="IGNORE"||(input.action==="REVERSE"&&!row.canRestore)?"IGNORED":"OUTSTANDING";
   await db.invoice.update({where:{id:item.id},data:{paymentState:state,paymentRevision:{increment:1}}});
   const event=await db.paymentEvent.create({data:{invoiceId:item.id,revision:item.revision+1,action:input.action,previousState:row.state,newState:state,actorId:actor.id,actorName:actor.name,amount:input.action==="PAY"?new Prisma.Decimal(row.balance):null,receivedDate:input.action==="PAY"?new Date(input.receivedDate!):null,reference:input.reference||null,notes:input.notes||null,reason:input.reason||null}});
   await log(db,`PAYMENT_${input.action}`,actor,row,event,item.id);changed.push(row.invoiceNumber);
  }
  if(changed.length>1)await log(db,`PAYMENT_BULK_${input.action}`,actor,null,{invoices:changed,...input});
  return {changed};
 },{timeout:30000,isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
}
export const trackingSchema=z.object({startDate:z.string().date().refine(v=>v<=localDateKey(),"Start date cannot be in the future."),token:z.string().optional()});
async function impact(db:Db,startDate:string){
 const snap=await paymentSnapshot(db),raw=await paymentInvoices(db),next={startDate,actorId:"",actorName:"",confirmedAt:""};
 const changes=raw.filter(i=>i.paymentState==="AUTO").flatMap(i=>{const row=snap.rows.find(r=>r.id===i.id)!;const state=effectivePaymentState(i,next,new Prisma.Decimal(row.balance));return state!==row.state?[{id:i.id,revision:i.paymentRevision,state,amount:row.balance}]:[]});
 const included=changes.filter(c=>c.state==="OUTSTANDING").length,excluded=changes.filter(c=>c.state==="IGNORED").length;
 const token=createHash("sha256").update(JSON.stringify({startDate,settings:snap.settings,changes})).digest("hex");
 return {included,excluded,total:sum(changes.map(c=>c.amount)),preserved:raw.filter(i=>i.paymentState!=="AUTO").length,token};
}
export async function previewTracking(startDate:string){return impact(prisma,startDate)}
export async function configureTracking(startDate:string,token:string,actor:{id:string;name:string}){
 return prisma.$transaction(async db=>{await lock(db);const before=await trackingSettings(db),preview=await impact(db,startDate);if(preview.token!==token)throw new PaymentError("Invoices changed since the preview. Review the updated impact and confirm again.");
 const value={startDate,actorId:actor.id,actorName:actor.name,confirmedAt:new Date().toISOString()};
 await db.appSetting.upsert({where:{key:KEY},create:{key:KEY,value,updatedBy:actor.id},update:{value,updatedBy:actor.id}});
 await log(db,before?"PAYMENT_TRACKING_CHANGED":"PAYMENT_TRACKING_CONFIGURED",actor,before,{...value,...preview});return value;
 },{timeout:30000,isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
