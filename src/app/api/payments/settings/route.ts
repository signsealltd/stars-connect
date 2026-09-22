import {NextRequest,NextResponse} from "next/server";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {trackingSchema,previewTracking,configureTracking,PaymentError} from "@/lib/payments";
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.PAYMENTS_SETTINGS,async user=>{
 const parsed=trackingSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError(parsed.error.issues.map(i=>i.message).join(" "),422);
 try{return NextResponse.json(parsed.data.token?await configureTracking(parsed.data.startDate,parsed.data.token,user):await previewTracking(parsed.data.startDate))}catch(e){if(e instanceof PaymentError)return jsonError(e.message,e.status);throw e}
})}
