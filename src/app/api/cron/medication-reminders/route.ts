import {NextRequest,NextResponse} from "next/server";
import {safeEqual} from "@/lib/security";
import {prisma} from "@/lib/prisma";
import {refreshMedications} from "@/lib/medication-service";
export async function POST(req:NextRequest){const secret=process.env.REPORT_JOB_SECRET||"",token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";if(!secret||!token||!safeEqual(secret,token))return NextResponse.json({error:"Unauthorised"},{status:401});const actor=await prisma.user.findFirst({where:{role:"ADMINISTRATOR",active:true}});if(!actor)return NextResponse.json({error:"Administrator required"},{status:409});return NextResponse.json({checked:await refreshMedications(actor.id)})}
