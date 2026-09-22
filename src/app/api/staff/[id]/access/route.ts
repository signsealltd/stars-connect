import {NextRequest,NextResponse} from "next/server";
import {randomBytes} from "crypto";
import bcrypt from "bcryptjs";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {audit} from "@/lib/audit";
const schema=z.object({accessLevelId:z.string().uuid(),staffApp:z.boolean().optional(),password:z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/).optional()});
export async function PUT(req:NextRequest,{params}:{params:Promise<{id:string}>}){return withCapability(req,CAPABILITIES.USERS_MANAGE,async actor=>{
 const {id}=await params,p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Select a level. New accounts need a 12-character password with upper/lowercase letters and a number.",422);
 const staff=await prisma.staffMember.findUnique({where:{id}}),level=await prisma.accessLevel.findUnique({where:{id:p.data.accessLevelId}});
 if(!staff||!level?.active)return jsonError("Staff member or active access level not found.",404);
 const account=staff.userId?await prisma.user.findUnique({where:{id:staff.userId}}):await prisma.user.findUnique({where:{email:staff.email.toLowerCase()}});
 if(account?.id===actor.id||account?.role==="ADMINISTRATOR")return jsonError("Administrator accounts must be managed in Users & Permissions.",409);
 if(!account&&!p.data.password&&!p.data.staffApp)return jsonError("Set an initial password to create this staff member's account.",422);
 if(account&&account.organisationId!==actor.organisationId)return jsonError("Account unavailable.",404);
 if(p.data.staffApp){if(!hasCapability(actor.role,CAPABILITIES.STAFF_ACCESS_MANAGE,actor.permissionOverrides))return jsonError("Staff access management permission is required.",403);if(!hasCapability(level.baseRole,CAPABILITIES.STAFF_PORTAL,level.permissions))return jsonError("Choose an access level with Staff Portal enabled.",422);if(!await prisma.staffCredential.findFirst({where:{staffId:id,kind:"PIN",active:true}}))return jsonError("Set and save this employee's clocking PIN first.",422);}
 const passwordHash=p.data.password?await bcrypt.hash(p.data.password,12):!account?await bcrypt.hash(randomBytes(32).toString("base64url"),12):undefined;
 let personalLink="";
 const username=account?.username||`staff.${staff.id.replaceAll("-", "").slice(0,24)}`;
 await prisma.$transaction(async tx=>{
   const user=account?await tx.user.update({where:{id:account.id},data:{accessLevelId:level.id,role:level.baseRole,permissionOverrides:level.permissions!,...(passwordHash?{passwordHash}:{})}}):await tx.user.create({data:{username,email:staff.email.toLowerCase(),organisationId:actor.organisationId,name:staff.displayName,passwordHash:passwordHash!,active:staff.active,role:level.baseRole,accessLevelId:level.id,permissionOverrides:level.permissions!}});
   await tx.staffMember.update({where:{id},data:{accessLevelId:level.id,userId:user.id}});
   await tx.session.deleteMany({where:{userId:user.id}});
   if(p.data.staffApp){const current=await tx.staffPortalAccount.findUnique({where:{staffId:id}});personalLink=current?.loginLink||randomBytes(32).toString("hex");await tx.staffPortalAccount.upsert({where:{staffId:id},create:{staffId:id,loginLink:personalLink,enabled:true},update:{loginLink:personalLink,enabled:true,pinHash:null,invitationHash:null,invitationExpiresAt:null,failures:0,lockedUntil:null}});await tx.staffPortalSession.deleteMany({where:{accountId:id}});await tx.staffAccessEvent.create({data:{staffId:id,actorId:actor.id,action:"STAFF_APP_ENABLED",reason:"Staff profile setup with existing PIN"}});}
 });
 await audit("STAFF_ACCESS_ASSIGNED",{actorType:"USER",actorId:actor.id,entityType:"StaffMember",entityId:id,afterValue:{accessLevelId:level.id,levelName:level.name}});
 return NextResponse.json({ok:true,username,personalUrl:personalLink?new URL("/staff/?member="+personalLink,process.env.APP_URL||req.nextUrl.origin).href:undefined});
});}
