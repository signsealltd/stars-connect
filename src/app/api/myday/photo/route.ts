import {NextRequest,NextResponse} from "next/server";
import sharp from "sharp";
import {randomUUID} from "crypto";
import {prisma} from "@/lib/prisma";
import {myDayDate} from "@/lib/myday-rules";
import {storeDocument,loadDocument,deleteStoredDocument} from "@/lib/documents";
import {withMyday,mydayJson,requireMydayClient,MyDayError} from "@/lib/myday-auth";
export async function GET(req:NextRequest){return withMyday(req,async actor=>{
 const id=req.nextUrl.searchParams.get("client")||"",client=await requireMydayClient(id,true),docId=client.profilePhotoUrl?.split("document=")[1]?.split("&")[0];
 const hidden=(await prisma.myDayClient.findUnique({where:{studentId:id}}))?.hidden||!client.active;if(hidden&&!actor.admin&&!await prisma.myDayEntry.findFirst({where:{studentId:id,organisationId:actor.organisationId,day:myDayDate(),handover:true},select:{id:true}}))throw new MyDayError("Photo unavailable.",404);
 const doc=docId?await prisma.documentRecord.findFirst({where:{id:docId,sourceType:"StudentPhoto",sourceId:id,mimeType:"image/jpeg"}}):null;
 if(!doc)return mydayJson({error:"Photo unavailable."},404);
 return new NextResponse(new Uint8Array(await loadDocument(doc.storagePath)),{headers:{"content-type":"image/jpeg","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
});}
export async function POST(req:NextRequest){return withMyday(req,async actor=>{
 const id=req.nextUrl.searchParams.get("client")||"",client=await requireMydayClient(id,actor.admin);
 const consent=await prisma.studentConsentHistory.findFirst({where:{studentId:id,consentType:"photography",approvedAt:{not:null}},orderBy:[{approvedAt:"desc"},{createdAt:"desc"}]});
 const choice=consent?.newValue,allowed=choice===true||!!(choice&&typeof choice==="object"&&!Array.isArray(choice)&&"internalCareRecords" in choice&&choice.internalCareRecords===true&&!("none" in choice&&choice.none===true));
 if(!allowed)throw new MyDayError("Photo permission for internal care records is not confirmed. Ask a manager to review consent. You can still use the diary.",403);
 const form=await req.formData(),file=form.get("photo");if(!(file instanceof File)||file.size>8*1024*1024||file.size===0)throw new MyDayError("Choose a JPEG, PNG or WebP image smaller than 8 MB.",422);
 if(String(form.get("previous")||"")!==(client.profilePhotoUrl||""))throw new MyDayError("This photo changed. Reload before replacing it.",409);
 let content:Buffer;try{const image=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:25_000_000,animated:false}),meta=await image.metadata();if(!["jpeg","png","webp"].includes(meta.format||""))throw Error();content=await image.rotate().resize(640,640,{fit:"cover"}).jpeg({quality:88}).toBuffer();}catch{throw new MyDayError("The image could not be read. Choose a JPEG, PNG or WebP photograph.",422);}
 const now=new Date(),doc=await storeDocument({documentNumber:`photo-${id}-${randomUUID().slice(0,8)}`,documentType:"STUDENT_PHOTO",periodStart:now,periodEnd:now,version:1,createdById:actor.id,generationSource:"MYDAY",sourceType:"StudentPhoto",sourceId:id,mimeType:"image/jpeg",content});
 try{await prisma.$transaction(async tx=>{const changed=await tx.student.updateMany({where:{id,profilePhotoUrl:client.profilePhotoUrl},data:{profilePhotoUrl:`/api/students/${id}/photo?document=${doc.id}`}});if(!changed.count)throw new MyDayError("Another worker replaced this photo. Reload before saving.",409);await tx.auditLog.create({data:{action:"STUDENT_PHOTO_UPDATED",actorType:"USER",actorId:actor.id,entityType:"Student",entityId:id,afterValue:{documentId:doc.id}}});});}catch(e){await prisma.documentRecord.delete({where:{id:doc.id}});await deleteStoredDocument(doc.storagePath);throw e;}
 return mydayJson({saved:true});
});}
