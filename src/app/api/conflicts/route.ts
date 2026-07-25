import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole,jsonError,requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";
export async function GET(req:NextRequest){return withRole(req,"MANAGER",async()=>NextResponse.json(await prisma.syncConflict.findMany({orderBy:{createdAt:"desc"},take:200})))}
export async function PATCH(req:NextRequest){return withRole(req,"MANAGER",async user=>{const p=z.object({id:z.uuid(),status:z.literal("RESOLVED")}).safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Invalid conflict action.",422);const before=await prisma.syncConflict.findUnique({where:{id:p.data.id}});if(!before)return jsonError("Conflict not found.",404);const after=await prisma.syncConflict.update({where:{id:p.data.id},data:{status:"RESOLVED",resolvedAt:new Date()}});await audit("SYNC_CONFLICT_RESOLVED",{actorType:"USER",actorId:user.id,entityType:"SyncConflict",entityId:after.id,beforeValue:before,afterValue:after,...requestContext(req)});return NextResponse.json(after)})}
