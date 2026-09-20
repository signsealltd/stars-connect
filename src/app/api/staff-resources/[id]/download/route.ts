import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {canReadResource} from "@/lib/staff-resources";
import {loadDocument} from "@/lib/documents";
import {carePdf} from "@/lib/care-pdf";
import {audit} from "@/lib/audit";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){return withCapability(req,CAPABILITIES.STAFF_PORTAL,async user=>{const {id}=await params,row=await prisma.staffResource.findUnique({where:{id}});if(!row||!canReadResource(user,row))return jsonError("Document not available",404);const doc=row.documentId?await prisma.documentRecord.findUnique({where:{id:row.documentId}}):null;await audit("STAFF_RESOURCE_DOWNLOADED",{actorType:"USER",actorId:user.id,entityType:"StaffResource",entityId:id});if(row.status==="PUBLISHED")await prisma.staffResourceReceipt.upsert({where:{resourceId_userId:{resourceId:id,userId:user.id}},update:{},create:{resourceId:id,userId:user.id,viewedAt:new Date()}});return new NextResponse(doc?await loadDocument(doc.storagePath):carePdf(row.title,[`Version ${row.version} | ${row.status}`,row.content]),{headers:{"content-type":"application/pdf","content-disposition":`${req.nextUrl.searchParams.get("inline")==="1"?"inline":"attachment"}; filename="${row.category.toLowerCase()}-${row.id}-v${row.version}.pdf"`,"cache-control":"private, no-store"}});});}
