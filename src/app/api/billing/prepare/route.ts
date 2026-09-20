import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createHash} from "crypto";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {billingChoices,manualInvoiceAmounts,needsAmendmentReason} from "@/lib/billing-wizard";
import {calculateFundedRun} from "@/lib/funded-billing-service";
import {generateFundedInvoices} from "@/lib/funded-invoices";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_REVIEW,async()=>{try{return NextResponse.json(await billingChoices(req.nextUrl.searchParams.get("period")||""),{headers:{"cache-control":"private, no-store"}})}catch(e){return jsonError(e instanceof Error?e.message:"Unable to load clients.",422)}})}
const schema=z.object({periodId:z.string().uuid(),token:z.string().length(64),requestKey:z.string().uuid(),replaceExisting:z.boolean(),entries:z.array(z.object({studentId:z.string().uuid(),total:z.number().positive().max(1000000),reason:z.string().trim().max(2000).default("")})).min(1).max(500)});
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_APPROVE,async user=>{
 if(!hasCapability(user.role,CAPABILITIES.BILLING_EDIT,user.permissionOverrides))return jsonError("Invoice preparation access is required.",403);
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Check the selected clients and totals.",422);
 const d=parsed.data;if(new Set(d.entries.map(e=>e.studentId)).size!==d.entries.length)return jsonError("A client can only be selected once.",422);
 const hash=createHash("sha256").update(JSON.stringify(d)).digest("hex"),notes=`invoice-wizard:${hash}`;
 try{
  let run=await prisma.billingRun.findUnique({where:{requestKey:d.requestKey}});
  if(run&&run.notes!==notes)throw Error("This request was already used with different totals. Start another selection.");
  if(run?.status==="INVOICES_GENERATED")return NextResponse.json({runId:run.id,invoices:await prisma.invoice.findMany({where:{billingRunId:run.id}})});
  const choices=await billingChoices(d.periodId);
  if(choices.token!==d.token)throw Error("Client details or invoices have changed. Refresh the choices and check the totals again.");
  const selected=d.entries.map(entry=>{const row=choices.rows.find(r=>r.id===entry.studentId);if(!row)throw Error("A selected client is no longer eligible for this period.");if(row.error)throw Error(`${row.name}: ${row.error}`);if(row.existing&&!d.replaceExisting)throw Error(`${row.name} already has an invoice. Confirm replacement before continuing.`);manualInvoiceAmounts(entry.total,row.vatRate);if(needsAmendmentReason(row.total,entry.total)&&entry.reason.length<5)throw Error(`${row.name}: give a short reason for the changed total.`);return {entry,row}});
  if(!run)run=await prisma.$transaction(async tx=>{
   await tx.appSetting.upsert({where:{key:"billingRunLock"},update:{updatedBy:user.id},create:{key:"billingRunLock",value:true,updatedBy:user.id}});
   const duplicate=await tx.billingRun.findUnique({where:{requestKey:d.requestKey}});if(duplicate)return duplicate;
   const previous=await tx.billingRun.findFirst({where:{periodStart:choices.period.periodStart,periodEnd:choices.period.periodEnd},orderBy:{version:"desc"}});
   return tx.billingRun.create({data:{requestKey:d.requestKey,notes,label:choices.period.label,billingPeriodId:choices.period.id,periodStart:choices.period.periodStart,periodEnd:choices.period.periodEnd,bankHolidayDates:choices.period.bankHolidayDates!,selectedStudentIds:d.entries.map(e=>e.studentId),createdById:user.id,version:(previous?.version||0)+1}});
  });
  if(run.notes!==notes)throw Error("This request was already used with different totals.");
  if(["DRAFT","REQUIRES_REVIEW","REVIEWED"].includes(run.status)){
   if(run.status==="DRAFT")await calculateFundedRun(run.id);
   const id=run.id;
   await prisma.$transaction(async tx=>{
    const claim=await tx.billingRun.updateMany({where:{id,status:{in:["REQUIRES_REVIEW","REVIEWED"]}},data:{updatedAt:new Date()}});if(!claim.count)return;
    const charges=await tx.billingCharge.findMany({where:{billingRunId:id}});if(charges.length!==selected.length)throw Error("Client selection changed. Start again.");
    for(const {entry,row} of selected){const charge=charges.find(c=>c.studentId===entry.studentId);if(!charge||charge.billingProfileId!==row.profileId)throw Error(`${row.name}: billing details changed.`);
     const amended=row.total===null||Math.abs(row.total-entry.total)>0.001;
     const reason=entry.reason||"Confirmed invoice total";
     if(amended)await tx.billingCharge.update({where:{id:charge.id},data:{...manualInvoiceAmounts(entry.total,row.vatRate),description:"Day service",exceptionCode:null,excluded:false,manuallyAdjusted:true,adjustmentReason:reason}});
     else if(charge.exceptionCode||Math.abs(Number(charge.grossAmount)-entry.total)>0.001)throw Error(`${row.name}: calculated total changed. Refresh the choices.`);
     await tx.auditLog.create({data:{action:"BILLING_TOTAL_CONFIRMED",actorType:"USER",actorId:user.id,entityType:"BillingCharge",entityId:charge.id,beforeValue:{calculatedTotal:row.total},afterValue:{finalTotal:entry.total,reason,manuallyChanged:amended}}});
    }
    await tx.billingRun.update({where:{id},data:{status:"LOCKED",approvedById:user.id,approvedAt:new Date(),lockedAt:new Date()}});
    await tx.auditLog.create({data:{action:"BILLING_WIZARD_APPROVED",actorType:"USER",actorId:user.id,entityType:"BillingRun",entityId:id,afterValue:{clientCount:selected.length,replacementsConfirmed:d.replaceExisting}}});
   });
  }
  const invoices=await generateFundedInvoices(run.id,user.id,{expectedPrevious:Object.fromEntries(selected.map(({row})=>[row.id,row.existing?.id||null]))});
  return NextResponse.json({runId:run.id,invoices});
 }catch(e){return jsonError(e instanceof Error?e.message:"Invoices could not be created. Please retry.",409)}
 });}
