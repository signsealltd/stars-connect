import {NextRequest,NextResponse} from "next/server";
import {safeEqual} from "@/lib/security";
import {scheduledIhascoSync} from "@/lib/ihasco-service";

export async function POST(req:NextRequest){
  const secret=process.env.REPORT_JOB_SECRET||"",token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
  if(!secret||!token||!safeEqual(secret,token))return NextResponse.json({error:"Unauthorised"},{status:401});
  const result=await scheduledIhascoSync();
  const failed=("status" in result&&result.status==="FAILED")||("ok" in result&&!result.ok);
  return NextResponse.json(result,{status:failed?503:200});
}
