import {Prisma} from "@prisma/client";
import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {withVehicle,canReviewFleet} from "@/lib/fleet-auth";
import {submissionSchema} from "@/lib/vehicle-checklist";
import {submitVehicleCheck} from "@/lib/fleet-service";
import {jsonError} from "@/lib/api";
export async function POST(req:NextRequest){return withVehicle(req,async user=>{const parsed=submissionSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Complete the check, photographs and declaration.",422);try{return NextResponse.json(await submitVehicleCheck(parsed.data,user));}catch(e){return jsonError(e instanceof Prisma.PrismaClientKnownRequestError||e instanceof Prisma.PrismaClientUnknownRequestError?"Unable to save right now. Your check is retained; please retry.":e instanceof Error?e.message:"Unable to submit check.",409);}});}
export async function GET(req:NextRequest){return withVehicle(req,async user=>{
 const manager=await canReviewFleet(),q=req.nextUrl.searchParams,id=q.get("id"),vehicleId=q.get("vehicle"),outcome=q.get("outcome"),staff=q.get("staff"),from=q.get("from"),to=q.get("to");
 if((from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to)))return jsonError("Choose valid dates.",422);
 const rows=await prisma.vehicleCheck.findMany({where:{...(!manager?{userId:user.id}:staff?{userId:staff}:{}),...(id?{id}:{}),...(vehicleId?{vehicleId}:{}),...(outcome?{outcome}:{}),...(q.get("defects")==="yes"?{defects:{some:{}}}:{}),...((from||to)?{checkDate:{...(from?{gte:new Date(from)}:{}),...(to?{lte:new Date(to)}:{})}}:{})},include:{defects:true},orderBy:{submittedAt:"desc"},take:500});
 return NextResponse.json(rows,{headers:{"cache-control":"private, no-store"}});
});}
