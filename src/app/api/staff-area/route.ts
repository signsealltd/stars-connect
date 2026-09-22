import {canReadResource} from "@/lib/staff-resources";
import {NextRequest} from "next/server";
import {z} from "zod";
import {withStaff,staffJson} from "@/lib/staff-area-auth";
import {personalData} from "@/lib/staff-area-data";
import {prisma} from "@/lib/prisma";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
export async function GET(req:NextRequest){return withStaff(req,async i=>staffJson(await personalData(i,req.nextUrl.searchParams.get("month")||new Date().toISOString().slice(0,7))))}
export async function PATCH(req:NextRequest){return withStaff(req,async i=>{
 const p=z.object({name:z.string().trim().min(1).max(120),phone:z.string().max(40),address:z.string().max(1000),emergencyContact:z.string().max(1000),notifications:z.boolean()}).safeParse(await req.json());if(!p.success)return staffJson({error:"Check your profile details."},422);
 await prisma.$transaction(async tx=>{await tx.staffMember.update({where:{id:i.staff.id},data:{displayName:p.data.name,phone:p.data.phone}});await tx.staffPortalAccount.update({where:{staffId:i.staff.id},data:{profile:{address:p.data.address,emergencyContact:p.data.emergencyContact},preferences:{notifications:p.data.notifications}}});await tx.staffAccessEvent.create({data:{staffId:i.staff.id,actorId:i.user.id,action:"PROFILE_UPDATED",reason:"Employee updated permitted contact details"}});await tx.staffRequest.create({data:{staffId:i.staff.id,organisationId:i.user.organisationId!,idempotencyKey:crypto.randomUUID(),type:"PROFILE",status:"COMPLETED",involvedUserIds:[],details:{description:"Contact details updated",before:{name:i.staff.displayName,phone:i.staff.phone,profile:i.account.profile},after:p.data},events:{create:{actorId:i.user.id,action:"CONTACT_DETAILS_UPDATED",message:"Your permitted contact details were updated",staffVisible:true}}}})});return staffJson({ok:true});
},CAPABILITIES.STAFF_OWN_EDIT)}
export async function POST(req:NextRequest){return withStaff(req,async i=>{
 const p=z.object({action:z.enum(["read","confirm","decline","policy","remove-passkey"]),id:z.string().max(1024),note:z.string().max(2000).default("")}).safeParse(await req.json());if(!p.success)return staffJson({error:"Invalid action."},422);const v=p.data;
 if(v.action==="read")await prisma.staffPortalNotification.updateMany({where:{id:v.id,staffId:i.staff.id},data:{readAt:new Date()}});
 else if(v.action==="remove-passkey"){await prisma.staffPasskey.deleteMany({where:{id:v.id,accountId:i.staff.id}});await prisma.staffAccessEvent.create({data:{staffId:i.staff.id,actorId:i.user.id,action:"PASSKEY_REMOVED",reason:"Employee removed a device"}})}
 else if(v.action==="policy"){
  const resource=await prisma.staffResource.findFirst({where:{id:v.id,status:"PUBLISHED",studentId:null}});if(!resource||!canReadResource(i.user,resource))return staffJson({error:"Policy unavailable."},404);
  const receipt=await prisma.staffResourceReceipt.findFirst({where:{resourceId:v.id,userId:i.user.id}});
  if(receipt)await prisma.staffResourceReceipt.update({where:{id:receipt.id},data:{viewedAt:new Date(),readAt:new Date(),agreedAt:new Date()}});else await prisma.staffResourceReceipt.create({data:{resourceId:v.id,userId:i.user.id,viewedAt:new Date(),readAt:new Date(),agreedAt:new Date()}});
 }else{
  if(!hasCapability(i.user.role,CAPABILITIES.STAFF_CALENDAR,i.user.permissionOverrides))return staffJson({error:"Calendar permission required."},403);
  if(v.action==="decline"&&!v.note.trim())return staffJson({error:"Tell your manager why you cannot attend."},422);
  const result=await prisma.operationStaffAssignment.updateMany({where:{id:v.id,staffId:i.staff.id,organisationId:i.user.organisationId!,status:"ASSIGNED",occurrence:{status:{notIn:["CANCELLED","COMPLETED"]}}},data:{confirmation:v.action==="confirm"?"CONFIRMED":"UNAVAILABLE",responseNote:v.note}});if(!result.count)return staffJson({error:"Assignment unavailable."},404);
  await prisma.auditLog.create({data:{action:"STAFF_ATTENDANCE_RESPONSE",actorType:"USER",actorId:i.user.id,entityType:"OperationStaffAssignment",entityId:v.id,afterValue:{confirmation:v.action}}});
 }return staffJson({ok:true});
})}
