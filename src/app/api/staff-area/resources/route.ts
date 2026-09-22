import {NextRequest,NextResponse} from "next/server";
import {withStaff,staffJson,staffHeaders} from "@/lib/staff-area-auth";
import {prisma} from "@/lib/prisma";
import {canReadResource} from "@/lib/staff-resources";
import {loadDocument} from "@/lib/documents";
export async function GET(req:NextRequest){return withStaff(req,async i=>{
 const r=await prisma.staffResource.findFirst({where:{id:req.nextUrl.searchParams.get('id')||'',status:'PUBLISHED',studentId:null}});if(!r?.documentId||!canReadResource(i.user,r))return staffJson({error:'Document unavailable.'},404);
 const d=await prisma.documentRecord.findUnique({where:{id:r.documentId}});if(!d)return staffJson({error:'Document unavailable.'},404);
 await prisma.staffResourceReceipt.upsert({where:{resourceId_userId:{resourceId:r.id,userId:i.user.id}},create:{resourceId:r.id,userId:i.user.id,viewedAt:new Date()},update:{viewedAt:new Date()}});
 return new NextResponse(await loadDocument(d.storagePath),{headers:{...staffHeaders,'Content-Type':d.mimeType,'Content-Disposition':'attachment; filename="staff-document.pdf"'}});
})}
