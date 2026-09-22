import {staffSession} from "./staff-area-auth";
import {NextRequest,NextResponse} from "next/server";
import {getSession} from "./security";
import {hasCapability,CAPABILITIES} from "./permission-catalog";
import {mutationOriginAllowed,jsonError} from "./api";
import {rateLimit} from "./rate-limit";
import type {User} from "@prisma/client";
export async function withVehicle(req:NextRequest,handler:(user:User)=>Promise<NextResponse>){
 if(!mutationOriginAllowed(req))return jsonError("Request origin was rejected.",403);
 const staffRoute=req.nextUrl.pathname.startsWith("/api/staff-area/vehicle/");
 const staff=staffRoute?await staffSession():null;
 const session=staffRoute?(staff?{user:staff.user,scope:"VEHICLE"}:null):await getSession(true);if(!session)return jsonError("Sign in to continue. Your local draft is safe.",401);
 if(!hasCapability(session.user.role,CAPABILITIES.VEHICLE_CHECK,session.user.permissionOverrides)&&!(req.method==="GET"&&session.scope!=="VEHICLE"&&hasCapability(session.user.role,CAPABILITIES.FLEET_VIEW,session.user.permissionOverrides)))return jsonError("Vehicle-check access is not enabled for your account.",403);
 if(req.method!=="GET"&&!rateLimit(`vehicle:${session.user.id}`,100,60000).allowed)return jsonError("Please wait before retrying.",429);
 return handler(session.user);
}
export async function canReviewFleet(req?:NextRequest){if(req?.nextUrl.pathname.startsWith("/api/staff-area/vehicle/"))return false;const s=await getSession();return !!s&&hasCapability(s.user.role,CAPABILITIES.FLEET_VIEW,s.user.permissionOverrides);}
