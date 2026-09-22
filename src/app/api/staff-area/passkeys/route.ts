import {NextRequest} from "next/server";
import {cookies} from "next/headers";
import {randomBytes} from "crypto";
import {generateRegistrationOptions,generateAuthenticationOptions,verifyRegistrationResponse,verifyAuthenticationResponse,type RegistrationResponseJSON,type AuthenticationResponseJSON} from "@simplewebauthn/server";
import {prisma} from "@/lib/prisma";
import {staffSession,staffJson,newStaffSession} from "@/lib/staff-area-auth";
import {sha256} from "@/lib/security";
import {mutationOriginAllowed,requestContext} from "@/lib/api";
import {rateLimit} from "@/lib/rate-limit";
export async function POST(req:NextRequest){
 if(!mutationOriginAllowed(req))return staffJson({error:"Request origin rejected."},403);
 if(!rateLimit("staff-passkey:"+(requestContext(req).ipAddress||"shared"),30,60_000).allowed)return staffJson({error:"Please wait before trying again."},429);
 const body=await req.json().catch(()=>({}));const origin=new URL(process.env.APP_URL||req.nextUrl.origin).origin,rpID=new URL(origin).hostname;
 const jar=await cookies();const identity=await staffSession();
 try{
  if(body.action==="register-options"||body.action==="login-options"){
   const register=body.action==="register-options";if(register&&!identity)return staffJson({error:"Sign in before adding a passkey."},401);
   const options=register?await generateRegistrationOptions({rpName:"STARS Staff",rpID,userName:identity!.staff.email,userID:new TextEncoder().encode(identity!.staff.id),attestationType:"none",authenticatorSelection:{residentKey:"required",userVerification:"required"},excludeCredentials:await prisma.staffPasskey.findMany({where:{accountId:identity!.staff.id},select:{credentialId:true}}).then(rows=>rows.map(r=>({id:r.credentialId})))}):await generateAuthenticationOptions({rpID,userVerification:"required"});
   const token=randomBytes(32).toString("base64url");await prisma.staffAuthChallenge.deleteMany({where:{expiresAt:{lt:new Date()}}});
   await prisma.staffAuthChallenge.create({data:{accountId:identity?.staff.id||"00000000-0000-0000-0000-000000000000",tokenHash:sha256(token),challenge:options.challenge,purpose:register?"REGISTER":"LOGIN",expiresAt:new Date(Date.now()+300_000)}});
   jar.set("stars_staff_challenge",token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/api/staff-area/passkeys",maxAge:300});return staffJson(options);
  }
  const token=jar.get("stars_staff_challenge")?.value;if(!token)return staffJson({error:"Passkey request expired. Try again."},400);
  const challenge=await prisma.staffAuthChallenge.findUnique({where:{tokenHash:sha256(token)}});if(!challenge||challenge.expiresAt<new Date())return staffJson({error:"Passkey request expired."},400);
  const consumed=await prisma.staffAuthChallenge.deleteMany({where:{id:challenge.id}});if(!consumed.count)return staffJson({error:"Passkey request already used."},400);jar.delete("stars_staff_challenge");
  if(body.action==="register-verify"&&challenge.purpose==="REGISTER"&&identity?.staff.id===challenge.accountId){
   const result=await verifyRegistrationResponse({response:body.response as RegistrationResponseJSON,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true});
   if(!result.verified)return staffJson({error:"Passkey could not be verified."},400);
   const c=result.registrationInfo.credential;await prisma.$transaction(async tx=>{const valid=await tx.staffPortalAccount.updateMany({where:{staffId:identity.staff.id,enabled:true,sessions:{some:{id:identity.session.id}}},data:{updatedAt:new Date()}});if(!valid.count)throw Error("Session revoked");await tx.staffPasskey.create({data:{id:sha256(c.id),credentialId:c.id,accountId:identity.staff.id,publicKey:Buffer.from(c.publicKey),counter:BigInt(c.counter),transports:c.transports||[],name:String(body.name||"My device").slice(0,100)}});},{isolationLevel:"Serializable"});
   await prisma.staffAccessEvent.create({data:{staffId:identity.staff.id,actorId:identity.user.id,action:"PASSKEY_ADDED",reason:"Verified device unlock credential"}});return staffJson({ok:true});
  }
  if(body.action==="login-verify"&&challenge.purpose==="LOGIN"){
   const c=await prisma.staffPasskey.findUnique({where:{id:sha256(String(body.response?.id||""))},include:{account:{include:{staff:true}}}});if(!c?.account.enabled||!c.account.staff.active)return staffJson({error:"Unable to sign in with this passkey."},401);
   const result=await verifyAuthenticationResponse({response:body.response as AuthenticationResponseJSON,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,credential:{id:c.credentialId,publicKey:new Uint8Array(c.publicKey),counter:Number(c.counter)}});
   if(!result.verified)return staffJson({error:"Unable to verify device unlock."},401);
   const updated=await prisma.staffPasskey.updateMany({where:{id:c.id,counter:c.counter},data:{counter:BigInt(result.authenticationInfo.newCounter)}});if(!updated.count)return staffJson({error:"Please try signing in again."},409);
   await newStaffSession(c.accountId,{passkeyId:c.id});await prisma.staffAccessEvent.create({data:{staffId:c.accountId,action:"LOGIN",reason:"Verified passkey"}});return staffJson({ok:true});
  }
 }catch{return staffJson({error:"Passkey could not be used. Try again or use your Staff Area PIN."},400)}
 return staffJson({error:"Invalid passkey request."},400);
}
