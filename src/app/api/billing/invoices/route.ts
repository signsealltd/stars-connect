import {deleteInvoices,invoiceDeletionSchema} from "@/lib/invoice-deletion";
import {NextRequest,NextResponse} from "next/server";
import type {Prisma} from "@prisma/client";
import {withCapability} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_REVIEW,async()=>{
 const q=req.nextUrl.searchParams,search=(q.get("search")||"").slice(0,100),month=q.get("month"),history=q.get("history")==="true",requested=Number(q.get("page"))||1,page=Number.isSafeInteger(requested)?Math.max(1,requested):1;
 const client=(q.get("client")||"").slice(0,120),payer=(q.get("payer")||"").slice(0,191),status=(q.get("status")||"").slice(0,30);
 const periods=await prisma.billingPeriod.findMany({select:{id:true,invoiceMonth:true}});
 const start=month&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?new Date(`${month}-01`):null;
 const where:Prisma.InvoiceWhereInput={...(client?{studentName:{contains:client}}:{}),...(payer?{payerName:{contains:payer}}:{}),...(status?{status}:history?{}:{status:{notIn:["SUPERSEDED","DELETED"]}}),...(search?{OR:[{studentName:{contains:search}},{payerName:{contains:search}},{invoiceNumber:{contains:search}},{purchaseOrderNumber:{contains:search}}]}:{}),...(start?{billingRun:{OR:[{billingPeriodId:{in:periods.filter(p=>p.invoiceMonth===month).map(p=>p.id)}},{billingPeriodId:null,periodStart:{gte:start,lt:new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1))}}]}}:{})};
 const [rows,total]=await Promise.all([prisma.invoice.findMany({where,include:{billingRun:{select:{label:true,periodStart:true,periodEnd:true,billingPeriodId:true}}},orderBy:[{createdAt:"asc"},{id:"asc"}],skip:(page-1)*25,take:25}),prisma.invoice.count({where})]);
 return NextResponse.json({rows:rows.map(row=>({...row,billingRun:{...row.billingRun,invoiceMonth:periods.find(p=>p.id===row.billingRun.billingPeriodId)?.invoiceMonth||row.billingRun.periodStart.toISOString().slice(0,7)}})),total});
});}

export async function DELETE(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_APPROVE,async user=>{if(!hasCapability(user.role,CAPABILITIES.BILLING_EDIT,user.permissionOverrides))return NextResponse.json({error:"Billing editing and approval access are required."},{status:403});const parsed=invoiceDeletionSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Choose up to 100 invoices and enter a deletion reason of at least 3 characters."},{status:422});return NextResponse.json(await deleteInvoices(parsed.data,user.id));});}
