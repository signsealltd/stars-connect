import {NextRequest,NextResponse} from "next/server";
import {mkdir,writeFile,readFile,unlink} from "fs/promises";
import path from "path";
import {randomUUID} from "crypto";
import {prisma} from "@/lib/prisma";
import {withStaff,staffSession,staffJson,staffHeaders} from "@/lib/staff-area-auth";
import {getSession} from "@/lib/security";
import {canReviewStaffRequest} from "@/lib/staff-task-access";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
const root=path.resolve(process.env.STAFF_DOCUMENT_STORAGE_PATH||path.join(process.cwd(),".data","staff-private"));
export async function POST(req:NextRequest){return withStaff(req,async i=>{
 if(Number(req.headers.get("content-length")||0)>11*1024*1024)return staffJson({error:"Choose a file under 10 MB."},413);
 const form=await req.formData(),file=form.get("file"),requestId=String(form.get("requestId")||"");
 if(!(file instanceof File)||file.size>10*1024*1024||!file.size)return staffJson({error:"Choose a PDF, PNG or JPEG under 10 MB."},422);
 const trainingRecordId=String(form.get("trainingRecordId")||"");
 const training=trainingRecordId?await prisma.staffTrainingRecord.findFirst({where:{id:trainingRecordId,staffId:i.staff.id}}):null;
 const request=await prisma.staffRequest.findFirst({where:{id:requestId,staffId:i.staff.id,organisationId:i.user.organisationId!}});if(!request&&!training)return staffJson({error:"Request unavailable."},404);
 const bytes=Buffer.from(await file.arrayBuffer());const mime=bytes.subarray(0,5).toString()==="%PDF-"?"application/pdf":bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?"image/png":bytes[0]===255&&bytes[1]===216&&bytes[2]===255?"image/jpeg":null;
 if(!mime)return staffJson({error:"Only PDF, PNG and JPEG files are accepted."},422);
 await mkdir(root,{recursive:true});const storagePath=path.join(root,randomUUID());await writeFile(storagePath,bytes,{flag:"wx",mode:0o600});
 try{const document=await prisma.staffPrivateDocument.create({data:{staffId:i.staff.id,requestId:request?.id,trainingRecordId:training?.id,storagePath,filename:file.name.replace(/[^\w .()-]/g,"_").slice(0,191),mimeType:mime,expiresAt:new Date(Date.now()+Math.max(1,Math.min(3650,Number(process.env.STAFF_DOCUMENT_RETENTION_DAYS)||365))*86400000)}});if(request)await prisma.staffRequestEvent.create({data:{requestId,actorId:i.user.id,action:"DOCUMENT_UPLOADED",message:"Supporting document uploaded",staffVisible:true}});return staffJson({id:document.id},201)}catch(e){await unlink(storagePath);throw e}
},CAPABILITIES.STAFF_OWN_REQUEST)}
export async function GET(req:NextRequest){
 const d=await prisma.staffPrivateDocument.findUnique({where:{id:req.nextUrl.searchParams.get("id")||""},include:{request:true}});if(!d||d.expiresAt<new Date())return staffJson({error:"Document unavailable."},404);
 const own=await staffSession();const manager=own?null:await getSession();
 const training=manager&&d.trainingRecordId?await prisma.staffTrainingRecord.findFirst({where:{id:d.trainingRecordId,staffId:d.staffId,staff:{userId:{in:(await prisma.user.findMany({where:{organisationId:manager.user.organisationId},select:{id:true}})).map(u=>u.id)}}}}):null;
 const allowed=own?.staff.id===d.staffId||manager&&hasCapability(manager.user.role,CAPABILITIES.STAFF_HR_DOCUMENTS,manager.user.permissionOverrides)&&(d.request?canReviewStaffRequest(manager.user,d.request):training&&hasCapability(manager.user.role,CAPABILITIES.STAFF_TRAINING,manager.user.permissionOverrides));
 if(!allowed)return staffJson({error:"Document unavailable."},404);
 const resolved=path.resolve(d.storagePath);if(!resolved.startsWith(root+path.sep))return staffJson({error:"Document unavailable."},404);
 if(d.requestId)await prisma.staffRequestEvent.create({data:{requestId:d.requestId,actorId:own?.user.id||manager!.user.id,action:"DOCUMENT_DOWNLOADED",message:"Private document accessed",staffVisible:false}});
 if(!d.requestId)await prisma.staffAccessEvent.create({data:{staffId:d.staffId,actorId:own?.user.id||manager!.user.id,action:"TRAINING_DOCUMENT_DOWNLOADED",reason:"Private training evidence accessed"}});
 return new NextResponse(await readFile(resolved),{headers:{...staffHeaders,"Content-Type":d.mimeType,"Content-Disposition":`attachment; filename="${d.filename}"`,"X-Content-Type-Options":"nosniff"}});
}
