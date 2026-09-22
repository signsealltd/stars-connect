import {applyVehicleUserAccess} from "@/lib/vehicle-user-access";
import {NextRequest,NextResponse} from "next/server";
import bcrypt from "bcryptjs";
import {prisma} from "@/lib/prisma";
import {authenticateDevice} from "@/lib/device-auth";
import {sha256,createSession} from "@/lib/security";
import {mutationOriginAllowed,jsonError} from "@/lib/api";
import {rateLimit} from "@/lib/rate-limit";
import {audit} from "@/lib/audit";
import {CAPABILITIES,hasCapability} from "@/lib/permission-catalog";
export async function POST(req:NextRequest){
 if(!mutationOriginAllowed(req))return jsonError("Request origin was rejected.",403);
 const device=await authenticateDevice(req);if(!device)return jsonError("Use your STARS account on this phone, or a provisioned tablet for PIN sign-in.",401);
 if(!rateLimit(`fleet-pin:${device.id}`,5,60000).allowed)return jsonError("Please wait before trying again.",429);
 const body=await req.json().catch(()=>null);if(!/^\d{4,8}$/.test(body?.pin||""))return jsonError("PIN not recognised.",401);
 const credential=await prisma.staffCredential.findFirst({where:{kind:"PIN",lookupHash:sha256(body.pin),active:true},include:{staff:true}});
 if(!credential||!credential.staff.active||!credential.staff.userId||!await bcrypt.compare(body.pin,credential.valueHash))return jsonError("PIN not recognised or staff access has not been set up.",401);
 const user=await prisma.user.findUnique({where:{id:credential.staff.userId}});if(!user?.active)return jsonError("Staff account unavailable.",403);
 const level=user.accessLevelId?await prisma.accessLevel.findUnique({where:{id:user.accessLevelId}}):null;
 await applyVehicleUserAccess(user);
 const allowed=(user.role==="ADMINISTRATOR"||!user.accessLevelId||level?.active)&&hasCapability(user.role,CAPABILITIES.VEHICLE_CHECK,user.permissionOverrides);
 if(!allowed)return jsonError("Ask management to enable Vehicle check for you under Fleet → User access.",403);
 await createSession(user.id,"VEHICLE");await audit("VEHICLE_PIN_SIGN_IN",{actorType:"USER",actorId:user.id,deviceId:device.id});
 return NextResponse.json({id:user.id,name:user.name});
}
