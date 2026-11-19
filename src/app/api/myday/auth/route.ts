import {NextRequest} from "next/server";
import {cookies} from "next/headers";
import {randomBytes} from "crypto";
import bcrypt from "bcryptjs";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {endStaffSession} from "@/lib/staff-area-auth";
import {endSession,sha256} from "@/lib/security";
import {rateLimit} from "@/lib/rate-limit";
import {mutationOriginAllowed,requestContext} from "@/lib/api";
import {MYDAY_COOKIE,mydayEnabled,mydayOrganisation,mydayActor,mydayJson,issueMydayGrant,staffStillAllowed,MyDayError} from "@/lib/myday-auth";
export async function GET(){try{if(!await mydayEnabled())return mydayJson({enabled:false},404);const actor=await mydayActor();return mydayJson({enabled:true,actor});}catch(e){return mydayJson({error:e instanceof MyDayError?e.message:"My Day is not available yet."},503);}}
export async function POST(req:NextRequest){
 if(!mutationOriginAllowed(req))return mydayJson({error:"Request origin rejected."},403);
 try{if(!await mydayEnabled())return mydayJson({error:"My Day is switched off."},404);
 const input=z.object({pin:z.string().regex(/^\d{4,8}$/)}).safeParse(await req.json().catch(()=>null));if(!input.success)return mydayJson({error:"Enter your existing staff PIN."},422);
 if(!rateLimit(`myday-pin:${requestContext(req).ipAddress||"shared"}`,8,60_000).allowed)return mydayJson({error:"Please wait a minute before trying again."},429);
 const credential=await prisma.staffCredential.findFirst({where:{kind:"PIN",active:true,lookupHash:sha256(input.data.pin)},include:{staff:true}});
 if(!credential||!await bcrypt.compare(input.data.pin,credential.valueHash)||!await staffStillAllowed(credential.staffId,credential.id,credential.valueHash))return mydayJson({error:"PIN not recognised or staff access is unavailable."},401);
 const organisationId=await mydayOrganisation();if(credential.staff.userId){const user=await prisma.user.findUnique({where:{id:credential.staff.userId}});if(user?.organisationId&&user.organisationId!==organisationId)return mydayJson({error:"This PIN does not have access to this service."},403);}
 const actor={id:credential.staffId,staffId:credential.staffId,name:credential.staff.displayName,organisationId,admin:false};const token=randomBytes(32).toString("base64url");
 await prisma.myDaySession.create({data:{tokenHash:sha256(token),staffId:credential.staffId,credentialId:credential.id,credentialHash:credential.valueHash,organisationId,expiresAt:new Date(Date.now()+8*3600_000)}});
 await endStaffSession();await endSession();
 (await cookies()).set(MYDAY_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:8*3600});
 await prisma.auditLog.create({data:{action:"MYDAY_UNLOCKED",actorType:"USER",actorId:credential.staffId,entityType:"StaffMember",entityId:credential.staffId}});
 return mydayJson({actor,grant:await issueMydayGrant(actor,credential.id,credential.valueHash)});
 }catch(e){return mydayJson({error:e instanceof MyDayError?e.message:"My Day is not available yet. Ask your administrator to check the deployment."},503);}
}
export async function DELETE(req:NextRequest){if(!mutationOriginAllowed(req))return mydayJson({error:"Request origin rejected."},403);const jar=await cookies(),token=jar.get(MYDAY_COOKIE)?.value;if(token)await prisma.myDaySession.deleteMany({where:{tokenHash:sha256(token)}});jar.delete(MYDAY_COOKIE);await endStaffSession();await endSession();return mydayJson({ok:true});}
