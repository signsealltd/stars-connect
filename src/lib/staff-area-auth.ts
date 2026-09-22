import {applyVehicleUserAccess} from "./vehicle-user-access";
import {cookies} from "next/headers";
import {randomBytes} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {prisma} from "./prisma";
import {sha256,endSession} from "./security";
import {CAPABILITIES,hasCapability,type Capability} from "./permission-catalog";
import {mutationOriginAllowed} from "./api";
export const STAFF_COOKIE="stars_staff_session";
export const staffHeaders={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie"};
export const staffJson=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:staffHeaders});
export async function staffSession(){
 const token=(await cookies()).get(STAFF_COOKIE)?.value;if(!token)return null;
 const now=new Date();const session=await prisma.staffPortalSession.findUnique({where:{tokenHash:sha256(token)},include:{account:{include:{staff:true}}}});
 if(!session||session.expiresAt<=now||session.lastSeenAt.getTime()<Date.now()-15*60_000||!session.account.enabled||!session.account.staff.active||session.account.staff.archivedAt)return null;
 const userId=session.account.staff.userId;if(!userId)return null;
 const user=await prisma.user.findUnique({where:{id:userId}});if(!user?.active||!user.organisationId)return null;
 if(user.accessLevelId&&user.role!=="ADMINISTRATOR"){const level=await prisma.accessLevel.findUnique({where:{id:user.accessLevelId}});if(!level?.active)return null;user.role=level.baseRole;user.permissionOverrides={...Object.fromEntries(Object.values(CAPABILITIES).map(c=>[c,false])),...(level.permissions as Record<string,boolean>)};}
 await applyVehicleUserAccess(user);
 if(!hasCapability(user.role,CAPABILITIES.STAFF_PORTAL,user.permissionOverrides))return null;
 await prisma.staffPortalSession.updateMany({where:{id:session.id,lastSeenAt:session.lastSeenAt},data:{lastSeenAt:now}});
 return {session,account:session.account,staff:session.account.staff,user};
}
export async function newStaffSession(staffId:string,proof:{credentialId?:string;credentialHash?:string;passkeyId?:string}){
 const token=randomBytes(32).toString("base64url");
 await prisma.$transaction(async tx=>{
  const locked=await tx.staffPortalAccount.updateMany({where:{staffId,enabled:true,invitationHash:null,staff:{active:true,archivedAt:null}},data:{lastLoginAt:new Date(),failures:0,lockedUntil:null}});
  if(!locked.count)throw Error("Access changed; sign in again");
  if(proof.passkeyId&&!await tx.staffPasskey.findFirst({where:{id:proof.passkeyId,accountId:staffId}}))throw Error("Passkey revoked");
  if(proof.credentialId&&!await tx.staffCredential.findFirst({where:{id:proof.credentialId,staffId,kind:"PIN",active:true,valueHash:proof.credentialHash}}))throw Error("PIN changed");
  if(!proof.credentialId&&!proof.passkeyId)throw Error("Authentication proof required");
  await tx.staffPortalSession.create({data:{accountId:staffId,tokenHash:sha256(token),expiresAt:new Date(Date.now()+8*3600_000)}});
 },{isolationLevel:"Serializable"});
 await endSession();
 (await cookies()).set(STAFF_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/"});
}
export async function endStaffSession(){const jar=await cookies();const token=jar.get(STAFF_COOKIE)?.value;if(token)await prisma.staffPortalSession.deleteMany({where:{tokenHash:sha256(token)}});jar.delete(STAFF_COOKIE);}
export type StaffIdentity=NonNullable<Awaited<ReturnType<typeof staffSession>>>;
export async function withStaff(req:NextRequest,handler:(identity:StaffIdentity)=>Promise<NextResponse>,cap?:Capability){
 if(!mutationOriginAllowed(req))return staffJson({error:"Request origin rejected."},403);
 const identity=await staffSession();if(!identity)return staffJson({error:"Please sign in to STARS Staff."},401);
 if(cap&&!hasCapability(identity.user.role,cap,identity.user.permissionOverrides))return staffJson({error:"You do not have permission to do that."},403);
 try{return await handler(identity)}catch{return staffJson({error:"Unable to complete the request. Please try again."},500)}
}
