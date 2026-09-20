import {NextRequest,NextResponse} from "next/server";
import {safeEqual} from "@/lib/security";
import {prisma} from "@/lib/prisma";
import {prepareMonthlyBilling} from "@/lib/funded-billing-service";
import {refreshSafeguarding} from "@/lib/safeguarding-service";
export async function POST(req:NextRequest){const expected=process.env.REPORT_JOB_SECRET||"",supplied=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";if(!expected||!supplied||!safeEqual(expected,supplied))return NextResponse.json({error:"Unauthorised"},{status:401});const actor=await prisma.user.findFirst({where:{role:"ADMINISTRATOR",active:true}});if(!actor)return NextResponse.json({error:"An active administrator is required."},{status:409});const run=await prepareMonthlyBilling(new Date(),actor.id);await refreshSafeguarding();return NextResponse.json({ok:true,billingRunId:run?.id||null});}
