import {fundedCountAmounts} from "@/lib/funded-days";
import {NextRequest,NextResponse} from "next/server";
import bcrypt from "bcryptjs";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError,requestContext} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {audit} from "@/lib/audit";
import {calculateFundedRun} from "@/lib/funded-billing-service";
import {generateFundedInvoices} from "@/lib/funded-invoices";
import {calculateInvoiceServiceLine} from "@/lib/invoice-service-line";
type Params={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:Params){return withCapability(req,CAPABILITIES.BILLING_REVIEW,async()=>{
 const {id}=await params,row=await prisma.billingRun.findUnique({where:{id},include:{charges:{orderBy:[{studentName:"asc"},{sourceDate:"asc"}]},invoices:true}});
 if(!row)return jsonError("Not found",404);
 const auditHistory=await prisma.auditLog.findMany({where:{OR:[{entityType:"BillingRun",entityId:id},{entityType:"BillingCharge",entityId:{in:row.charges.map(c=>c.id)}}]},orderBy:{createdAt:"desc"},take:100});
 return NextResponse.json({...row,auditHistory});
});}
export async function PATCH(req:NextRequest,{params}:Params){const body=await req.json().catch(()=>null);if(!body)return jsonError("Invalid request",422);return withCapability(req,["approve","lock","generate-invoices"].includes(body.action)?CAPABILITIES.BILLING_APPROVE:CAPABILITIES.BILLING_EDIT,async user=>{
 const {id}=await params;
 const action=String(body.action||""),reason=String(body.reason||"").trim();
 try {
  if(action==="calculate"){const result=await calculateFundedRun(id);await audit("BILLING_RUN_CALCULATED",{actorType:"USER",actorId:user.id,entityType:"BillingRun",entityId:id,...requestContext(req)});return NextResponse.json(result);}
  if(action==="generate-invoices")return NextResponse.json(await generateFundedInvoices(id,user.id));
  const result=await prisma.$transaction(async tx=>{
   const states=action==="approve"?["REQUIRES_REVIEW","REVIEWED"]:action==="lock"?["APPROVED"]:["DRAFT","REQUIRES_REVIEW","REVIEWED"];
   const claim=await tx.billingRun.updateMany({where:{id,status:{in:states},...(body.updatedAt?{updatedAt:new Date(body.updatedAt)}:{})},data:{updatedAt:new Date()}});
   if(!claim.count)throw new Error("This run changed or is locked. Refresh it, or create a new revision of a completed run.");
   const run=await tx.billingRun.findUniqueOrThrow({where:{id},include:{charges:true}});
   if(action==="approve"){
    const included=run.charges.filter(c=>!c.excluded);
    if(!run.charges.length||included.some(c=>c.exceptionCode))throw new Error("Approval blocked: confirm funding details and resolve all warnings first.");
    return tx.billingRun.update({where:{id},data:{status:"APPROVED",approvedById:user.id,approvedAt:new Date()}});
   }
   if(action==="lock")return tx.billingRun.update({where:{id},data:{status:"LOCKED",lockedAt:new Date()}});
   if(reason.length<5||reason.length>2000)throw new Error("Record a reason of 5 to 2,000 characters.");
   if(action==="manual-charge"){
    const profile=await tx.billingProfile.findUnique({where:{id:String(body.billingProfileId||"")}});
    const student=await tx.student.findUnique({where:{id:String(body.studentId||"")}});
    const sourceDate=new Date(`${body.sourceDate}T00:00:00Z`),description=String(body.description||"").trim();
    if(!profile||!student||profile.studentId!==student.id)throw new Error("Select the client's own billing profile.");
    if(Number.isNaN(sourceDate.getTime())||sourceDate<run.periodStart||sourceDate>run.periodEnd||description.length<2||description.length>191)throw new Error("Choose a service date within the period and a description.");
    const quantity=Number(body.quantity),unitRate=Number(body.unitRate),vatRate=Number(profile.vatRate),amounts=calculateInvoiceServiceLine(quantity,unitRate,vatRate);
    return tx.billingCharge.create({data:{billingRunId:id,billingProfileId:profile.id,studentId:student.id,studentName:student.displayName,payerName:profile.payerName,sourceDate,description,quantity,unitRate,vatRate,...amounts,manuallyAdjusted:true,adjustmentReason:reason}});
   }
   const charge=run.charges.find(c=>c.id===String(body.chargeId));if(!charge)throw new Error("Charge not found in this billing run.");
   if(action==="set-funded-days"){
    if(!charge.chargeRuleId||["MISSING_BILLING_PROFILE","OVERLAPPING_FUNDING_PROFILES","LBE_PERIOD_REQUIRED"].includes(charge.exceptionCode||""))throw Error("Correct the funding profile or period first.");
    const days=Number(body.fundedDays),removed=Number(body.removedDays);
    const amounts=fundedCountAmounts(days,charge.bankHolidayDays,removed,Number(charge.unitRate),Number(charge.vatRate));
    return tx.billingCharge.update({where:{id:charge.id},data:{...amounts,fundedDays:days,removedDays:removed,description:`Agreed funded days: ${days} less ${charge.bankHolidayDays} bank holidays and ${removed} management removals`,exceptionCode:null,manuallyAdjusted:true,adjustmentReason:reason}});
   }
   if(action==="note-charge")return {ok:true};
   if(charge.exceptionCode)throw new Error("Correct the funding profile and refresh calculations. Missing allocations cannot be waived or removed.");
   if(action==="exclude-charge"||action==="restore-charge")return tx.billingCharge.update({where:{id:charge.id},data:{excluded:action==="exclude-charge",manuallyAdjusted:true,adjustmentReason:reason}});
   throw new Error("Unsupported action. Correct the funding schedule or remove an agreed day with a reason.");
  });
  await audit(`BILLING_${action.toUpperCase().replaceAll("-","_")}`,{actorType:"USER",actorId:user.id,entityType:body.chargeId?"BillingCharge":"BillingRun",entityId:body.chargeId||id,afterValue:{reason:reason||null},...requestContext(req)});
  return NextResponse.json(result);
 }catch(error){return jsonError(error instanceof Error?error.message:"Unable to update this run",409);}
});}
export async function DELETE(req:NextRequest,{params}:Params){return withCapability(req,CAPABILITIES.BILLING_EDIT,async user=>{
 const {id}=await params,body=await req.json().catch(()=>null);
 if(!body?.password||!await bcrypt.compare(String(body.password),user.passwordHash))return jsonError("Your password was not accepted.",401);
 try{await prisma.$transaction(async tx=>{
  const claim=await tx.billingRun.updateMany({where:{id,status:{in:["DRAFT","REQUIRES_REVIEW","REVIEWED"]}},data:{updatedAt:new Date()}});if(!claim.count)throw new Error("Only unissued draft runs can be deleted.");
  if(await tx.invoice.count({where:{billingRunId:id}}))throw new Error("Invoice history must be retained.");
  await tx.operationalTask.updateMany({where:{billingRunId:id},data:{billingRunId:null,status:"OPEN",notes:"Draft run removed. Prepare a replacement billing run."}});
  await tx.billingRun.delete({where:{id}});
 });await audit("BILLING_RUN_DELETED",{actorType:"USER",actorId:user.id,entityType:"BillingRun",entityId:id});return NextResponse.json({ok:true});}catch(error){return jsonError(error instanceof Error?error.message:"Unable to delete run",409)}
});}
