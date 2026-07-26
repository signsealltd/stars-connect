import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { withRole,jsonError,requestContext } from "@/lib/api";
import { sendDailySummary } from "@/lib/email";
import { audit } from "@/lib/audit";
export async function POST(req:NextRequest){return withRole(req,"ADMINISTRATOR",async user=>{const p=z.object({date:z.string().date()}).safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Choose a valid date.",422);try{const result=await sendDailySummary({date:p.data.date,triggeredBy:"RESEND",userId:user.id});await audit("DAILY_SUMMARY_RESENT",{actorType:"USER",actorId:user.id,entityType:"DailySummaryEmail",entityId:result.id,afterValue:{date:p.data.date},...requestContext(req)});return NextResponse.json(result)}catch{return jsonError("The email could not be accepted by the SMTP server. Check Email settings and history.",500)}})}
