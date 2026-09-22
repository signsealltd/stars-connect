import {NextRequest,NextResponse} from "next/server";
import sharp from "sharp";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withVehicle,canReviewFleet} from "@/lib/fleet-auth";
import {jsonError} from "@/lib/api";
import {writeComplianceFile,readComplianceFile,removeComplianceFile,contentMatchesMime} from "@/lib/compliance-files";
import {audit} from "@/lib/audit";
export async function GET(req:NextRequest){return withVehicle(req,async user=>{
 const id=req.nextUrl.searchParams.get("id")||"";const row=await prisma.documentRecord.findFirst({where:{id,sourceType:"VEHICLE_EVIDENCE"}});
 if(!row||(row.createdById!==user.id&&!await canReviewFleet(req)))return jsonError("Photograph not found.",404);
 await audit("VEHICLE_EVIDENCE_VIEWED",{actorType:"USER",actorId:user.id,entityType:"DocumentRecord",entityId:id});
 return new NextResponse(await readComplianceFile(row.storagePath),{headers:{"content-type":"image/jpeg","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
});}
export async function POST(req:NextRequest){return withVehicle(req,async user=>{
 const form=await req.formData().catch(()=>null),file=form?.get("file"),id=form?.get("id"),checkId=form?.get("checkId");
 if(!z.string().uuid().safeParse(id).success||!z.string().uuid().safeParse(checkId).success||!(file instanceof File))return jsonError("Choose a photograph.",422);
 const existing=await prisma.documentRecord.findUnique({where:{id:String(id)}});
 if(existing)return existing.createdById===user.id&&existing.sourceId===checkId&&existing.sourceType==="VEHICLE_EVIDENCE"?NextResponse.json({id:existing.id}):jsonError("Image ID unavailable.",409);
 if(await prisma.vehicleCheck.findUnique({where:{id:String(checkId)}}))return jsonError("Submitted checks are immutable.",409);
 if(!file.size||file.size>10*1024*1024)return jsonError("Photographs must be under 10 MB.",422);
 const bytes=Buffer.from(await file.arrayBuffer());if(!["image/jpeg","image/png"].includes(file.type)||!contentMatchesMime(bytes,file.type))return jsonError("Choose a JPEG or PNG photograph.",422);
 let content:Buffer;try{content=await sharp(bytes,{limitInputPixels:40000000}).rotate().resize({width:1920,height:1920,fit:"inside",withoutEnlargement:true}).jpeg({quality:88}).toBuffer();}catch{return jsonError("This photograph cannot be read.",422);}
 const stored=await writeComplianceFile(content,"image/jpeg");
 try{const now=new Date();await prisma.documentRecord.create({data:{id:String(id),documentNumber:`VC-${id}`,documentType:"VEHICLE_EVIDENCE",sourceType:"VEHICLE_EVIDENCE",sourceId:String(checkId),createdById:user.id,periodStart:now,periodEnd:now,version:1,generationSource:"CAMERA_UPLOAD",mimeType:"image/jpeg",...stored}});}catch(error){await removeComplianceFile(stored.storagePath);const duplicate=await prisma.documentRecord.findUnique({where:{id:String(id)}});if(!duplicate||duplicate.createdById!==user.id||duplicate.sourceId!==checkId)throw error;}
 return NextResponse.json({id});
});}
