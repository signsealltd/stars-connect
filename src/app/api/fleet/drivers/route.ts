import {NextRequest,NextResponse} from "next/server";
import {randomBytes,randomUUID} from "crypto";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {driverKey,type DriverLink} from "@/lib/vehicle-driver-access";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.FLEET_MANAGE,async actor=>{
 if(!hasCapability(actor.role,CAPABILITIES.USERS_MANAGE,actor.permissionOverrides))return jsonError("User-management permission is required.",403);
 const rows=await prisma.appSetting.findMany({where:{key:{startsWith:"vehicleDriver:"}},orderBy:{updatedAt:"desc"}});
 const seen=new Set<string>();
 return NextResponse.json(rows.sort((a,b)=>Number((b.value as DriverLink).enabled)-Number((a.value as DriverLink).enabled)).flatMap(row=>{const v=row.value as DriverLink;if(v.organisationId!==actor.organisationId||seen.has(v.userId))return [];seen.add(v.userId);return [{id:row.key,name:v.name,enabled:v.enabled}]}),{headers:{"Cache-Control":"private, no-store"}});
});}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.FLEET_MANAGE,async actor=>{
 if(!hasCapability(actor.role,CAPABILITIES.USERS_MANAGE,actor.permissionOverrides))return jsonError("User-management permission is required.",403);
 const parsed=z.object({action:z.enum(["create","replace","disable"]),name:z.string().trim().min(2).max(120).optional(),id:z.string().regex(/^vehicleDriver:[a-f0-9]{64}$/).optional()}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Check the driver name and action.",422);
 const v=parsed.data;if(v.action==="create"&&!v.name)return jsonError("Enter the driver's name.",422);
 const old=v.action!=="create"&&v.id?await prisma.appSetting.findUnique({where:{key:v.id}}):null;const previous=old?.value as DriverLink|undefined;
 if(v.action!=="create"&&(!previous||previous.organisationId!==actor.organisationId))return jsonError("Driver link not found.",404);
 const token=randomBytes(32).toString("hex");
 await prisma.$transaction(async tx=>{
  if(previous&&old){const links=await tx.appSetting.findMany({where:{key:{startsWith:"vehicleDriver:"}}});for(const row of links){const value=row.value as DriverLink;if(value.userId===previous.userId&&value.organisationId===actor.organisationId&&value.enabled)await tx.appSetting.update({where:{key:row.key},data:{value:{...value,enabled:false},updatedBy:actor.id}});}}
  if(v.action!=="disable"){
   const user=previous?{id:previous.userId}:await tx.user.create({data:{username:"driver."+randomUUID().replaceAll("-","").slice(0,24),name:v.name!,passwordHash:"!disabled-driver-login",role:"CARE_ASSISTANT",active:false,organisationId:actor.organisationId,permissionOverrides:Object.fromEntries(Object.values(CAPABILITIES).map(c=>[c,false]))}});
   await tx.appSetting.create({data:{key:driverKey(token),value:{userId:user.id,organisationId:actor.organisationId!,name:previous?.name||v.name!,enabled:true},updatedBy:actor.id}});
  }
  await tx.auditLog.create({data:{action:"VEHICLE_DRIVER_LINK_"+v.action.toUpperCase(),actorType:"USER",actorId:actor.id,entityType:"User",entityId:previous?.userId,afterValue:{name:previous?.name||v.name,action:v.action}}});
 },{isolationLevel:"Serializable",timeout:20000});return NextResponse.json({ok:true,...(v.action!=="disable"?{url:new URL("/driver/start?token="+token,process.env.APP_URL||req.nextUrl.origin).href}:{})},{headers:{"Cache-Control":"private, no-store"}});
});}
