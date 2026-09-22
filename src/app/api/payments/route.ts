import {NextRequest,NextResponse} from "next/server";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {paymentSnapshot,filterPayments,mutatePayments,paymentActionSchema,PaymentError,sum} from "@/lib/payments";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.PAYMENTS_VIEW,async()=>{
 const snapshot=await paymentSnapshot(),q=req.nextUrl.searchParams,filtered=filterPayments(snapshot.rows,q),page=Math.max(1,Math.min(100000,Number(q.get("page"))||1));
 return NextResponse.json({...snapshot,rows:filtered.slice((page-1)*25,page*25),total:filtered.length,filteredTotal:sum(filtered.map(r=>r.state==="OUTSTANDING"?r.balance:r.amount)),periods:[...new Map(snapshot.rows.map(r=>[r.runId,{id:r.runId,label:r.periodLabel}])).values()]},{headers:{"Cache-Control":"private, no-store"}});
})}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.PAYMENTS_VIEW,async user=>{
 const parsed=paymentActionSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError(parsed.error.issues.map(i=>i.message).join(" "),422);
 const cap=parsed.data.action==="REVERSE"?CAPABILITIES.PAYMENTS_REVERSE:CAPABILITIES.PAYMENTS_RECORD;
 if(!hasCapability(user.role,cap,user.permissionOverrides))return jsonError("You do not have permission for this payment action.",403);
 try{return NextResponse.json(await mutatePayments(parsed.data,user))}catch(e){if(e instanceof PaymentError)return jsonError(e.message,e.status);throw e}
})}
