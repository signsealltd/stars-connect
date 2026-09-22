import {NextRequest} from "next/server";
import {randomBytes} from "crypto";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {sha256} from "@/lib/security";
import {staffJson} from "@/lib/staff-area-auth";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_ACCESS_MANAGE,async user=>{
 const staff=await prisma.staffMember.findMany({where:{archivedAt:null},select:{id:true,displayName:true,email:true,userId:true,portalAccount:{select:{enabled:true,failures:true,lockedUntil:true,lastLoginAt:true,invitationExpiresAt:true,pinHash:true,passkeys:{select:{id:true,name:true}}}}},orderBy:{displayName:"asc"}});
 const linked=await prisma.user.findMany({where:{organisationId:user.organisationId!},select:{id:true}});const ids=new Set(linked.map(u=>u.id));
 const history=await prisma.staffAccessEvent.findMany({where:{staffId:{in:staff.filter(s=>s.userId&&ids.has(s.userId)).map(s=>s.id)}},orderBy:{createdAt:"desc"},take:100});
 return staffJson({staff:staff.filter(s=>!s.userId||ids.has(s.userId)).map(s=>({...s,portalAccount:s.portalAccount?{...s.portalAccount,pinHash:undefined,status:!s.portalAccount.enabled?"Disabled":s.portalAccount.lockedUntil&&s.portalAccount.lockedUntil>new Date()?"Locked":s.portalAccount.pinHash?"Active":"Invited"}:null})),history,entryUrl:new URL("/staff/",process.env.APP_URL||req.nextUrl.origin).href});
})}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_ACCESS_MANAGE,async user=>{
 const p=z.object({staffId:z.string().uuid(),action:z.enum(["invite","reset","disable","unlock","signout","remove-passkeys"]),reason:z.string().trim().min(5).max(1000),revokePasskeys:z.boolean().default(true)}).safeParse(await req.json());if(!p.success)return staffJson({error:"Choose an action and enter a reason."},422);const v=p.data;
 const staff=await prisma.staffMember.findUnique({where:{id:v.staffId}});if(!staff?.active||!staff.userId)return staffJson({error:"Link this employee to an existing user account in their staff profile first."},422);
 const linked=await prisma.user.findFirst({where:{id:staff.userId,organisationId:user.organisationId!,active:true}});if(!linked)return staffJson({error:"Staff account unavailable."},404);
 const token=randomBytes(32).toString("base64url");
 await prisma.$transaction(async tx=>{
  await tx.staffPortalAccount.upsert({where:{staffId:staff.id},create:{staffId:staff.id},update:{}});
  if(v.action==="invite"||v.action==="reset"){
   await tx.staffPortalAccount.update({where:{staffId:staff.id},data:{enabled:true,pinHash:null,failures:0,lockedUntil:null,invitationHash:sha256(token),invitationExpiresAt:new Date(Date.now()+24*3600_000)}});
   if(v.revokePasskeys)await tx.staffPasskey.deleteMany({where:{accountId:staff.id}});
  }else if(v.action==="disable")await tx.staffPortalAccount.update({where:{staffId:staff.id},data:{enabled:false,invitationHash:null,invitationExpiresAt:null}});
  else if(v.action==="unlock")await tx.staffPortalAccount.update({where:{staffId:staff.id},data:{failures:0,lockedUntil:null}});
  else if(v.action==="remove-passkeys")await tx.staffPasskey.deleteMany({where:{accountId:staff.id}});
  if(v.action!=="unlock"){await tx.staffPortalSession.deleteMany({where:{accountId:staff.id}});await tx.session.deleteMany({where:{userId:staff.userId!}});}
  await tx.staffAuthChallenge.deleteMany({where:{accountId:staff.id}});
  await tx.staffAccessEvent.create({data:{staffId:staff.id,actorId:user.id,action:v.action.toUpperCase(),reason:v.reason}});
 });
 return staffJson({ok:true,...(["invite","reset"].includes(v.action)?{activationUrl:new URL("/staff/activate",process.env.APP_URL||req.nextUrl.origin).href+"#"+token}: {})});
})}
