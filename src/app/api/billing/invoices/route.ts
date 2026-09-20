import {NextRequest,NextResponse} from "next/server";
import type {Prisma} from "@prisma/client";
import {withCapability} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_REVIEW,async()=>{
 const q=req.nextUrl.searchParams,search=(q.get("search")||"").slice(0,100),month=q.get("month"),history=q.get("history")==="true",requested=Number(q.get("page"))||1,page=Number.isSafeInteger(requested)?Math.max(1,requested):1;
 const client=(q.get("client")||"").slice(0,120),payer=(q.get("payer")||"").slice(0,191),status=(q.get("status")||"").slice(0,30);
 const periods=await prisma.billingPeriod.findMany({select:{id:true,invoiceMonth:true}});
 const start=month&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?new Date(`${month}-01`):null;
 const where:Prisma.InvoiceWhereInput={...(client?{studentName:{contains:client}}:{}),...(payer?{payerName:{contains:payer}}:{}),...(status?{status}:history?{}:{status:{not:"SUPERSEDED"}}),...(search?{OR:[{studentName:{contains:search}},{payerName:{contains:search}},{invoiceNumber:{contains:search}},{purchaseOrderNumber:{contains:search}}]}:{}),...(start?{billingRun:{OR:[{billingPeriodId:{in:periods.filter(p=>p.invoiceMonth===month).map(p=>p.id)}},{billingPeriodId:null,periodStart:{gte:start,lt:new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1))}}]}}:{})};
 const [rows,total]=await Promise.all([prisma.invoice.findMany({where,include:{billingRun:{select:{periodStart:true,periodEnd:true,billingPeriodId:true}}},orderBy:[{billingRun:{periodStart:"desc"}},{payerName:"asc"},{createdAt:"desc"}],skip:(page-1)*25,take:25}),prisma.invoice.count({where})]);
 return NextResponse.json({rows:rows.map(row=>({...row,billingRun:{...row.billingRun,invoiceMonth:periods.find(p=>p.id===row.billingRun.billingPeriodId)?.invoiceMonth||row.billingRun.periodStart.toISOString().slice(0,7)}})),total});
});}
