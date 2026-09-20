import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {localDayBounds,localDateKey} from "@/lib/dates";
import {effectiveClockEvent} from "@/lib/timesheets";
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.TIMESHEETS_MANAGE,async user=>{
 const parsed=z.object({id:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Enter a reason for closing this alert.",422);
 const {start}=localDayBounds(localDateKey());
 const result=await prisma.$transaction(async tx=>{const original=await tx.clockEvent.findUnique({where:{id:parsed.data.id},include:{corrections:{orderBy:{createdAt:"asc"}}}});if(!original)return false;
 const event=effectiveClockEvent(original);if(event.type!=="CLOCK_IN"||event.deviceTimestamp>=start)return false;
 await tx.clockEvent.update({where:{id:event.id},data:{missingClockOutResolvedAt:new Date()}});
 await tx.auditLog.create({data:{action:"MISSING_CLOCK_OUT_ALERT_CLOSED",actorType:"USER",actorId:user.id,entityType:"ClockEvent",entityId:event.id,afterValue:{reason:parsed.data.reason,alertOnly:true}}});return true;});
 return result?NextResponse.json({ok:true}):jsonError("This historical clock-in alert is no longer available.",409);
 });}
