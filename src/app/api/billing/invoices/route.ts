import {NextRequest,NextResponse} from "next/server";
import {withCapability} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_REVIEW,async()=>{
  const q=req.nextUrl.searchParams,search=(q.get("search")||"").slice(0,100),month=q.get("month"),history=q.get("history")==="true",page=Math.max(1,Number(q.get("page"))||1);
  const start=month&&/^\d{4}-\d{2}$/.test(month)?new Date(`${month}-01`):null;
  const where={...(history?{}:{status:{not:"SUPERSEDED"}}),...(search?{OR:[{studentName:{contains:search}},{payerName:{contains:search}},{invoiceNumber:{contains:search}},{purchaseOrderNumber:{contains:search}}]}:{}),...(start&&!Number.isNaN(start.getTime())?{billingRun:{periodStart:{gte:start,lt:new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1))}}}:{})};
  const [rows,total]=await Promise.all([prisma.invoice.findMany({where,include:{billingRun:{select:{periodStart:true,periodEnd:true}}},orderBy:[{billingRun:{periodStart:"desc"}},{payerName:"asc"},{createdAt:"desc"}],skip:(page-1)*25,take:25}),prisma.invoice.count({where})]);
  return NextResponse.json({rows,total});
});}
