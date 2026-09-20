import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import sharp from "sharp";
import {prisma} from "@/lib/prisma";
import {CAPABILITIES} from "@/lib/permissions";
import {withCapability,jsonError} from "@/lib/api";
import {validateComplianceUpload,writeComplianceFile,readComplianceFile,removeComplianceFile} from "@/lib/compliance-files";
import {audit} from "@/lib/audit";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.FLEET_VIEW,async user=>{
 const id=req.nextUrl.searchParams.get("id"),vehicle=req.nextUrl.searchParams.get("vehicle");
 if(id){const row=await prisma.documentRecord.findFirst({where:{id,sourceType:"FLEET_DOCUMENT"}});if(!row)return jsonError("Document not found.",404);await audit("FLEET_DOCUMENT_VIEWED",{actorType:"USER",actorId:user.id,entityType:"DocumentRecord",entityId:id});return new NextResponse(await readComplianceFile(row.storagePath),{headers:{"content-type":row.mimeType,"content-disposition":`inline; filename="fleet-${id}.${row.mimeType==="application/pdf"?"pdf":"jpg"}"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});}
 return NextResponse.json(await prisma.documentRecord.findMany({where:{sourceType:"FLEET_DOCUMENT",...(vehicle?{sourceId:vehicle}:{})},select:{id:true,sourceId:true,mimeType:true,revisionReason:true,createdAt:true},orderBy:{createdAt:"desc"},take:500}),{headers:{"cache-control":"private, no-store"}});
});}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.FLEET_MANAGE,async user=>{
 const form=await req.formData().catch(()=>null),file=form?.get("file"),vehicleId=String(form?.get("vehicleId")||""),title=String(form?.get("title")||"").trim();
 if(!(file instanceof File)||!z.string().uuid().safeParse(vehicleId).success||!title||title.length>191)return jsonError("Choose a vehicle, title and file.",422);
 if(!await prisma.fleetVehicle.findUnique({where:{id:vehicleId}}))return jsonError("Vehicle not found.",404);
 if(!["image/jpeg","image/png","application/pdf"].includes(file.type)||file.size>10*1024*1024)return jsonError("Choose a PDF, JPEG or PNG under 10 MB.",422);
 let content=Buffer.from(await file.arrayBuffer()),mime=file.type;const error=validateComplianceUpload(file,content);if(error)return jsonError(error,422);
 if(mime.startsWith("image/")){try{content=await sharp(content,{limitInputPixels:40000000}).rotate().resize({width:1920,height:1920,fit:"inside",withoutEnlargement:true}).jpeg({quality:88}).toBuffer();mime="image/jpeg";}catch{return jsonError("Unreadable image.",422);}}
 const stored=await writeComplianceFile(content,mime),id=crypto.randomUUID(),now=new Date();try{const row=await prisma.$transaction(async tx=>{const r=await tx.documentRecord.create({data:{id,documentNumber:`FLEET-${id}`,documentType:"FLEET_DOCUMENT",sourceType:"FLEET_DOCUMENT",sourceId:vehicleId,createdById:user.id,periodStart:now,periodEnd:now,version:1,generationSource:"USER_UPLOAD",revisionReason:title,mimeType:mime,...stored}});await tx.auditLog.create({data:{action:"FLEET_DOCUMENT_UPLOADED",actorType:"USER",actorId:user.id,entityType:"DocumentRecord",entityId:id,afterValue:{vehicleId,title}}});return r;});return NextResponse.json({id:row.id});}catch(e){await removeComplianceFile(stored.storagePath);throw e;}
});}
