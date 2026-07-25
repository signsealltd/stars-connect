import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { sendDailySummary } from "@/lib/email";
import { audit } from "@/lib/audit";
import { localDateKey } from "@/lib/dates";

export async function POST(req:NextRequest){
 return withRole(req,"ADMINISTRATOR",async user=>{
  const parsed=z.object({recipient:z.email(),date:z.string().date().optional()}).safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return jsonError("Enter a valid test recipient.",422);
  try{const result=await sendDailySummary({date:parsed.data.date||localDateKey(),recipients:[parsed.data.recipient],triggeredBy:"TEST",userId:user.id});await audit("TEST_EMAIL_SENT",{actorType:"USER",actorId:user.id,entityType:"DailySummaryEmail",entityId:result.id,afterValue:{recipient:parsed.data.recipient},...requestContext(req)});return NextResponse.json(result)}
  catch(error){return jsonError(error instanceof Error?error.message:"Test email failed.",500)}
 })
}
