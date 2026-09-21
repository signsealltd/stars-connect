import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {withCapability,jsonError,requestContext} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {loadDocument,zipFiles} from "@/lib/documents";
import {audit} from "@/lib/audit";

const selection=z.object({invoiceIds:z.array(z.string().uuid()).min(1).max(100)});
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_REVIEW,async user=>{
 if(!hasCapability(user.role,CAPABILITIES.DOCUMENT_DOWNLOAD,user.permissionOverrides))return jsonError("Document download access is required.",403);
 const parsed=selection.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Select between 1 and 100 invoices to download.",422);
 const ids=[...new Set(parsed.data.invoiceIds)];
 const invoices=await prisma.invoice.findMany({where:{id:{in:ids}},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{id:true,invoiceNumber:true,version:true,documentId:true}});
 if(invoices.length!==ids.length||invoices.some(invoice=>!invoice.documentId))return jsonError("One or more selected invoices no longer have a downloadable PDF. Refresh the list and check your selection.",409);
 const documents=await prisma.documentRecord.findMany({where:{id:{in:invoices.map(invoice=>invoice.documentId!)}}});
 const files:Array<{name:string;content:Buffer}>=[];let bytes=0;
 for(const [index,invoice] of invoices.entries()){
  const document=documents.find(item=>item.id===invoice.documentId);
  if(!document||document.mimeType!=="application/pdf"||!["INVOICE","CREDIT_NOTE"].includes(document.documentType))return jsonError("A selected invoice PDF is unavailable. No partial download was created.",409);
  let content:Buffer;try{content=await loadDocument(document.storagePath)}catch{return jsonError("A selected invoice PDF could not be read. No partial download was created.",409)}
  bytes+=content.length;if(bytes>50*1024*1024)return jsonError("These invoices exceed the download size limit. Select a smaller group.",413);
  files.push({name:`${String(index+1).padStart(3,"0")}-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9._-]/g,"_")}-v${invoice.version}.pdf`,content});
 }
 const zip=zipFiles(files);
 await audit("INVOICE_SELECTION_DOWNLOADED",{actorType:"USER",actorId:user.id,entityType:"Invoice",afterValue:{invoiceIds:invoices.map(invoice=>invoice.id),count:invoices.length},...requestContext(req)});
 return new NextResponse(zip,{headers:{"content-type":"application/zip","content-disposition":"attachment; filename=\"STARS-invoices.zip\"","cache-control":"private, no-store"}});
});}
