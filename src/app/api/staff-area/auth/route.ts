import {NextRequest} from "next/server";
import bcrypt from "bcryptjs";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {sha256} from "@/lib/security";
import {mutationOriginAllowed,requestContext} from "@/lib/api";
import {rateLimit} from "@/lib/rate-limit";
import {portalPin} from "@/lib/staff-area-input";
import {endStaffSession,newStaffSession,staffJson} from "@/lib/staff-area-auth";
export async function POST(req:NextRequest){
 if(!mutationOriginAllowed(req))return staffJson({error:"Request origin rejected."},403);
 const limit=rateLimit(`staff-login:${requestContext(req).ipAddress||"shared"}`,15,60_000);if(!limit.allowed)return staffJson({error:"Please wait before trying again."},429);
 const parsed=z.object({action:z.enum(["login","activate","logout"]),identifier:z.string().max(191).optional(),member:z.string().regex(/^[a-f0-9]{64}$/).optional(),pin:portalPin.optional(),token:z.string().max(100).optional()}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return staffJson({error:"Check your sign-in details. Enter your existing clocking PIN."},400);
 const v=parsed.data;if(v.action==="logout"){await endStaffSession();return staffJson({ok:true})}
 if(!v.pin)return staffJson({error:"Enter your Staff Area PIN."},400);
 if(v.action==="activate"){
  if(!v.token)return staffJson({error:"The activation link is unavailable or has expired."},400);
  const hash=sha256(v.token);
  const id=await prisma.$transaction(async tx=>{
   const account=await tx.staffPortalAccount.findUnique({where:{invitationHash:hash},include:{staff:true}});
   if(!account?.enabled||!account.staff.active||account.lockedUntil&&account.lockedUntil>new Date()||!account.invitationExpiresAt||account.invitationExpiresAt<new Date())return null;
   const credential=await tx.staffCredential.findFirst({where:{staffId:account.staffId,kind:"PIN",active:true,lookupHash:sha256(v.pin!)}});
   if(!credential||!await bcrypt.compare(v.pin!,credential.valueHash)){const failures=account.failures+1;await tx.staffPortalAccount.update({where:{staffId:account.staffId},data:{failures,lockedUntil:new Date(Date.now()+(failures>=10?24*3600:Math.min(900,2**failures))*1000)}});await tx.staffAccessEvent.create({data:{staffId:account.staffId,action:"LOGIN_FAILED",reason:"Invalid activation PIN"}});return null;}
   const used=await tx.staffPortalAccount.updateMany({where:{staffId:account.staffId,invitationHash:hash,invitationExpiresAt:{gt:new Date()}},data:{pinHash:null,invitationHash:null,invitationExpiresAt:null,failures:0,lockedUntil:null}});if(!used.count)return null;
   await tx.staffPortalSession.deleteMany({where:{accountId:account.staffId}});
   await tx.staffAccessEvent.create({data:{staffId:account.staffId,action:"ACTIVATED",reason:"Single-use activation completed"}});return {staffId:account.staffId,credentialId:credential.id,credentialHash:credential.valueHash};
  });if(!id)return staffJson({error:"The activation link is unavailable or has expired."},400);await newStaffSession(id.staffId,{credentialId:id.credentialId,credentialHash:id.credentialHash});return staffJson({ok:true});
 }
 const staff=await prisma.staffMember.findFirst({where:{...(v.member?{portalAccount:{loginLink:v.member}}:{email:v.identifier?.trim().toLowerCase()||""}),active:true,archivedAt:null},include:{portalAccount:true}});
 const a=staff?.portalAccount;
 if(!a?.enabled||a.invitationHash||a.lockedUntil&&a.lockedUntil>new Date()){await bcrypt.compare(v.pin,"$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxAolhJW5fWa5ZY8.NCRxGpXDwa");return staffJson({error:"Unable to sign in. Check your details or ask your manager to recover access."},401)}
 const credential=await prisma.staffCredential.findFirst({where:{staffId:staff!.id,kind:"PIN",active:true,lookupHash:sha256(v.pin)}});
 if(!credential||!await bcrypt.compare(v.pin,credential.valueHash)){
  await prisma.$transaction(async tx=>{const current=await tx.staffPortalAccount.update({where:{staffId:a.staffId},data:{failures:{increment:1}}});await tx.staffPortalAccount.update({where:{staffId:a.staffId},data:{lockedUntil:new Date(Date.now()+(current.failures>=10?24*3600:Math.min(900,2**current.failures))*1000)}});await tx.staffAccessEvent.create({data:{staffId:a.staffId,action:"LOGIN_FAILED",reason:"Invalid credential"}})});
  return staffJson({error:"Unable to sign in. Please wait before retrying or ask your manager to recover access."},401);
 }
 await newStaffSession(a.staffId,{credentialId:credential!.id,credentialHash:credential!.valueHash});await prisma.staffAccessEvent.create({data:{staffId:a.staffId,action:"LOGIN",reason:"Existing staff PIN"}});return staffJson({ok:true});
}
