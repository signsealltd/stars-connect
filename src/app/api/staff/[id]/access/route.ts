import {NextRequest,NextResponse} from "next/server";
import bcrypt from "bcryptjs";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {audit} from "@/lib/audit";
const schema=z.object({accessLevelId:z.string().uuid(),password:z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/).optional()});
export async function PUT(req:NextRequest,{params}:{params:Promise<{id:string}>}){return withCapability(req,CAPABILITIES.USERS_MANAGE,async actor=>{
 const {id}=await params,p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Select a level. New accounts need a 12-character password with upper/lowercase letters and a number.",422);
 const staff=await prisma.staffMember.findUnique({where:{id}}),level=await prisma.accessLevel.findUnique({where:{id:p.data.accessLevelId}});
 if(!staff||!level?.active)return jsonError("Staff member or active access level not found.",404);
 const account=staff.userId?await prisma.user.findUnique({where:{id:staff.userId}}):await prisma.user.findUnique({where:{email:staff.email.toLowerCase()}});
 if(account?.id===actor.id||account?.role==="ADMINISTRATOR")return jsonError("Administrator accounts must be managed in Users & Permissions.",409);
 if(!account&&!p.data.password)return jsonError("Set an initial password to create this staff member's account.",422);
 const passwordHash=p.data.password?await bcrypt.hash(p.data.password,12):undefined;
 const username=account?.username||`staff.${staff.id.replaceAll("-", "").slice(0,24)}`;
 await prisma.$transaction(async tx=>{
   const user=account?await tx.user.update({where:{id:account.id},data:{accessLevelId:level.id,role:level.baseRole,permissionOverrides:level.permissions!,...(passwordHash?{passwordHash}:{})}}):await tx.user.create({data:{username,email:staff.email.toLowerCase(),organisationId:actor.organisationId,name:staff.displayName,passwordHash:passwordHash!,active:staff.active,role:level.baseRole,accessLevelId:level.id,permissionOverrides:level.permissions!}});
   await tx.staffMember.update({where:{id},data:{accessLevelId:level.id,userId:user.id}});
   await tx.session.deleteMany({where:{userId:user.id}});
 });
 await audit("STAFF_ACCESS_ASSIGNED",{actorType:"USER",actorId:actor.id,entityType:"StaffMember",entityId:id,afterValue:{accessLevelId:level.id,levelName:level.name}});
 return NextResponse.json({ok:true,username});
});}
