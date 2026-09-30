import {NextRequest,NextResponse} from "next/server";
import {withCapability} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {manualInvoiceSchema} from "@/lib/manual-invoice";
import {issueManualInvoice} from "@/lib/manual-invoice-service";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_REVIEW,async()=>{
 const [clients,profiles]=await Promise.all([prisma.student.findMany({select:{id:true,displayName:true,active:true},orderBy:{displayName:"asc"}}),prisma.billingProfile.findMany({orderBy:[{activeFrom:"desc"},{createdAt:"desc"}],select:{id:true,studentId:true,payerName:true,billingAddress:true,purchaseOrderNumber:true,paymentTermsDays:true,vatRate:true,updatedAt:true}})]);
 return NextResponse.json(clients.map(c=>({...c,profiles:profiles.filter(p=>p.studentId===c.id)})));
});}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_APPROVE,async user=>{
 if(!hasCapability(user.role,CAPABILITIES.BILLING_EDIT,user.permissionOverrides))return NextResponse.json({error:"Billing editing and approval access are required."},{status:403});
 const parsed=manualInvoiceSchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"Check the invoice details."},{status:422});
 return NextResponse.json(await issueManualInvoice(parsed.data,user.id),{status:201});
});}
