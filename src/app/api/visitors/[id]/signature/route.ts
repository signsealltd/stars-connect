import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { CAPABILITIES, hasCapability } from "@/lib/permissions";
import { audit } from "@/lib/audit";
type Params={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:Params){return withRole(req,"MANAGER",async user=>{if(!hasCapability(user.role,CAPABILITIES.VISITOR_SIGNATURE_VIEW,user.permissionOverrides))return jsonError("You do not have permission to view retained signatures.",403);const{id}=await params;const signature=await prisma.visitorSignature.findUnique({where:{visitId:id},select:{strokeData:true,pointCount:true,createdAt:true,deletedAt:true}});if(!signature||signature.deletedAt)return jsonError("The signature is no longer retained.",404);await audit("VISITOR_SIGNATURE_VIEWED",{actorType:"USER",actorId:user.id,entityType:"VisitorVisit",entityId:id,...requestContext(req)});return NextResponse.json(signature);})}