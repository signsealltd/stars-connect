import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {vehicleAccessKey} from "@/lib/vehicle-user-access";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.FLEET_MANAGE,async actor=>{
 if(!hasCapability(actor.role,CAPABILITIES.USERS_MANAGE,actor.permissionOverrides))return jsonError("User-management permission is required.",403);
 const users=await prisma.user.findMany({where:{organisationId:actor.organisationId,active:true},select:{id:true,name:true,role:true},orderBy:{name:"asc"}});
 const settings=await prisma.appSetting.findMany({where:{key:{in:users.map(u=>vehicleAccessKey(u.id))}}});
 return NextResponse.json(users.map(u=>({...u,enabled:u.role==="ADMINISTRATOR"||settings.some(s=>s.key===vehicleAccessKey(u.id)&&s.value===true)})));
});}
export async function PUT(req:NextRequest){return withCapability(req,CAPABILITIES.FLEET_MANAGE,async actor=>{
 if(!hasCapability(actor.role,CAPABILITIES.USERS_MANAGE,actor.permissionOverrides))return jsonError("User-management permission is required.",403);
 const parsed=z.object({userId:z.string().uuid(),enabled:z.boolean()}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Choose a user and access setting.",422);
 const {userId,enabled}=parsed.data;const user=await prisma.user.findFirst({where:{id:userId,organisationId:actor.organisationId,active:true}});if(!user)return jsonError("User not found.",404);
 if(user.role==="ADMINISTRATOR")return jsonError("Administrators always have full access.",422);
 await prisma.$transaction(async tx=>{
 await tx.appSetting.upsert({where:{key:vehicleAccessKey(userId)},create:{key:vehicleAccessKey(userId),value:enabled,updatedBy:actor.id},update:{value:enabled,updatedBy:actor.id}});
 await tx.auditLog.create({data:{action:"VEHICLE_CHECK_ACCESS_CHANGED",actorType:"USER",actorId:actor.id,entityType:"User",entityId:userId,afterValue:{enabled}}});
 });return NextResponse.json({ok:true});
});}
