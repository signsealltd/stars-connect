import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {canReadResource} from "@/lib/staff-resources";
import {storeDocument} from "@/lib/documents";
import {audit} from "@/lib/audit";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_PORTAL,async user=>{
 const canManage=hasCapability(user.role,CAPABILITIES.STAFF_RESOURCES_MANAGE,user.permissionOverrides);
 const rows=await prisma.staffResource.findMany({where:canManage?{}:{status:"PUBLISHED"},orderBy:{createdAt:"desc"}});
 const permitted=rows.filter(r=>canReadResource(user,r));
 const receipts=await prisma.staffResourceReceipt.findMany({where:{resourceId:{in:permitted.map(r=>r.id)},...(canManage?{}:{userId:user.id})}});
 const people=canManage?await prisma.user.findMany({where:{id:{in:receipts.map(r=>r.userId)}},select:{id:true,name:true}}):[];
 return NextResponse.json({canManage,rows:permitted.map(r=>({...r,receipt:receipts.find(x=>x.resourceId===r.id&&x.userId===user.id),receipts:canManage?receipts.filter(x=>x.resourceId===r.id).map(x=>({...x,userName:people.find(p=>p.id===x.userId)?.name})):undefined}))});
});}
const schema=z.object({title:z.string().trim().min(2).max(191),category:z.enum(["POLICY","RIDDOR","SDS","RAMS"]),content:z.string().trim().min(2).max(100000),reviewDate:z.string().date().optional()});
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_RESOURCES_MANAGE,async user=>{
 let body:unknown,file:File|undefined;
 if(req.headers.get("content-type")?.includes("multipart/form-data")){const form=await req.formData();body={title:form.get("title"),category:form.get("category"),content:form.get("content"),reviewDate:form.get("reviewDate")||undefined};const upload=form.get("file");if(upload instanceof File&&upload.size)file=upload;}else body=await req.json().catch(()=>null);
 const p=schema.safeParse(body);if(!p.success)return jsonError("Enter a title, category and document text or description.",422);
 let documentId;
 if(file){if(file.size>10*1024*1024||file.type!=="application/pdf")return jsonError("Upload a PDF smaller than 10 MB.",422);const content=Buffer.from(await file.arrayBuffer());if(content.subarray(0,5).toString()!=="%PDF-")return jsonError("The file is not a PDF.",422);const now=new Date();const doc=await storeDocument({documentNumber:`staff-resource-${randomUUID()}`,documentType:"STAFF_RESOURCE",periodStart:now,periodEnd:now,version:1,createdById:user.id,generationSource:"MANAGER",sourceType:"StaffResource",mimeType:"application/pdf",content});documentId=doc.id;}
 const row=await prisma.staffResource.create({data:{...p.data,reviewDate:p.data.reviewDate?new Date(p.data.reviewDate):null,seriesId:randomUUID(),documentId,createdById:user.id}});
 await audit("STAFF_RESOURCE_CREATED",{actorType:"USER",actorId:user.id,entityType:"StaffResource",entityId:row.id});return NextResponse.json(row,{status:201});
});}
