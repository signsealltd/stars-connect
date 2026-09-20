import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {canReadResource} from "@/lib/staff-resources";
import {audit} from "@/lib/audit";
const schema=z.object({action:z.enum(["view","read","agree","save","publish","revise","archive"]),content:z.string().min(2).max(100000).optional(),title:z.string().min(2).max(191).optional()});
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){return withCapability(req,CAPABILITIES.STAFF_PORTAL,async user=>{
 const {id}=await params,p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Invalid action",422);
 const row=await prisma.staffResource.findUnique({where:{id}});if(!row||!canReadResource(user,row))return jsonError("Resource not available",404);
 const action=p.data.action;
 if(["view","read","agree"].includes(action)){
  if(row.status!=="PUBLISHED")return jsonError("Only published versions can be acknowledged.",409);
  const receipt=await prisma.staffResourceReceipt.findUnique({where:{resourceId_userId:{resourceId:id,userId:user.id}}});
  if(action==="read"&&!receipt?.viewedAt)return jsonError("Open the document before confirming it is read.",409);
  if(action==="agree"&&!receipt?.readAt)return jsonError("Confirm you have read this version before agreeing.",409);
  const field=action==="view"?"viewedAt":action==="read"?"readAt":"agreedAt";
  await prisma.staffResourceReceipt.upsert({where:{resourceId_userId:{resourceId:id,userId:user.id}},update:{[field]:receipt?.[field]||new Date()},create:{resourceId:id,userId:user.id,[field]:new Date()}});
 }else{
  if(!hasCapability(user.role,CAPABILITIES.STAFF_RESOURCES_MANAGE,user.permissionOverrides))return jsonError("Document management permission is required.",403);
  if(action==="save"){if(row.status!=="DRAFT")return jsonError("Create a new revision before editing a published document.",409);const saved=await prisma.staffResource.updateMany({where:{id,status:"DRAFT"},data:{content:p.data.content,title:p.data.title}});if(!saved.count)return jsonError("This draft has changed status. Refresh before editing.",409);}
  if(action==="publish"){
   const cap=row.category==="POLICY"?CAPABILITIES.POLICY_APPROVE:row.category==="RAMS"?CAPABILITIES.RAMS_APPROVE:CAPABILITIES.COMPLIANCE_MANAGE;
   if(!hasCapability(user.role,cap,user.permissionOverrides))return jsonError("Approval permission is required to publish this category.",403);
   if(row.status!=="DRAFT")return jsonError("Only a reviewed draft can be published.",409);
   if(row.content.includes("NOT PROVIDED"))return jsonError("Complete the missing RAMS information before publication.",422);
   await prisma.$transaction(async tx=>{await tx.staffResource.updateMany({where:{seriesId:row.seriesId},data:{updatedAt:new Date()}});await tx.staffResource.updateMany({where:{seriesId:row.seriesId,status:"PUBLISHED"},data:{status:"SUPERSEDED"}});await tx.staffResource.update({where:{id},data:{status:"PUBLISHED",publishedById:user.id,publishedAt:new Date()}})});
  }
  if(action==="archive")await prisma.staffResource.update({where:{id},data:{status:"ARCHIVED"}});
  if(action==="revise"){const latest=await prisma.staffResource.findFirst({where:{seriesId:row.seriesId},orderBy:{version:"desc"}});await prisma.staffResource.create({data:{seriesId:row.seriesId,version:(latest?.version||0)+1,category:row.category,title:row.title,content:row.content,studentId:row.studentId,documentId:row.documentId,reviewDate:row.reviewDate,createdById:user.id}});}
 }
 await audit(`STAFF_RESOURCE_${action.toUpperCase()}`,{actorType:"USER",actorId:user.id,entityType:"StaffResource",entityId:id,afterValue:{version:row.version}});return NextResponse.json({ok:true});
});}
