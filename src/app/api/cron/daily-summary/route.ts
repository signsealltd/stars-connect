import { NextRequest,NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { getEmailSettings,sendDailySummary } from "@/lib/email";
import { APP_TIME_ZONE,localDateAsDatabaseDate,localDateKey } from "@/lib/dates";
import { safeEqual } from "@/lib/security";
import { prisma } from "@/lib/prisma";

export async function GET(req:NextRequest){
 const expected=process.env.CRON_SECRET||"",supplied=req.headers.get("authorization")?.replace(/^Bearer /,"")||"";
 if(!expected||!safeEqual(expected,supplied))return NextResponse.json({error:"Unauthorised"},{status:401});
 const settings=await getEmailSettings();
 if(!settings.enabled)return NextResponse.json({skipped:true,reason:"Daily summaries are disabled"});
 const date=localDateKey(),currentTime=formatInTimeZone(new Date(),APP_TIME_ZONE,"HH:mm");
 if(currentTime<settings.time)return NextResponse.json({skipped:true,reason:`Scheduled for ${settings.time} Europe/London`});
 const alreadySent=await prisma.dailySummaryEmail.findFirst({where:{date:localDateAsDatabaseDate(date),status:"SENT"}});
 if(alreadySent)return NextResponse.json({skipped:true,reason:"Summary already sent",id:alreadySent.id});
 try{return NextResponse.json(await sendDailySummary({date,triggeredBy:"CRON"}))}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Email failed"},{status:500})}
}
