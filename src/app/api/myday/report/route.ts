import {mydayTransaction} from "@/lib/myday-service";
import {NextRequest,NextResponse} from "next/server";
import sharp from "sharp";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withMyday,mydayJson,requireMydayClient,mydaySourceHash,MyDayError} from "@/lib/myday-auth";
import {reportContentSchema} from "@/lib/myday-rules";
import {mydayPdf,MyDayPdfOverflow} from "@/lib/myday-pdf";
import {loadInvoiceLogo} from "@/lib/invoice-logo";
import {loadDocument} from "@/lib/documents";
const sourceRows=(studentId:string,organisationId:string,month:string)=>prisma.myDayEntry.findMany({where:{studentId,organisationId,day:{startsWith:month}},orderBy:[{occurredAt:"asc"},{id:"asc"}],select:{id:true,version:true,content:true,occurredAt:true,authorName:true}});
export async function GET(req:NextRequest){return withMyday(req,async actor=>{
 const studentId=req.nextUrl.searchParams.get("client")||"";await requireMydayClient(studentId,true);const report=await prisma.myDayReport.findFirst({where:{studentId,organisationId:actor.organisationId}});
 if(req.nextUrl.searchParams.has("pdf")){if(!report)throw new MyDayError("No saved report.",404);return new NextResponse(new Uint8Array(report.pdf),{headers:{"content-type":"application/pdf","content-disposition":`${req.nextUrl.searchParams.has("download")?"attachment":"inline"}; filename="My-Month-${report.month}.pdf"`,"cache-control":"private, no-store"}});}
 const month=req.nextUrl.searchParams.get("month")||report?.month||new Date().toISOString().slice(0,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new MyDayError("Choose a month.",422);
 const sources=await sourceRows(studentId,actor.organisationId,month),currentSources=report&&report.month!==month?await sourceRows(studentId,actor.organisationId,report.month):sources;
 return mydayJson({report:report?{month:report.month,content:report.content,version:report.version,edited:report.edited,updatedAt:report.updatedAt,stale:mydaySourceHash(currentSources)!==report.sourceHash}:null,sources,sourceHash:mydaySourceHash(sources),aiAvailable:false});
},true);}
const input=z.object({studentId:z.string().uuid(),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),version:z.number().int().nonnegative(),sourceHash:z.string().length(64),content:reportContentSchema,action:z.enum(["save","preview","generate"]),replaceConfirmed:z.boolean().default(false)});
export async function POST(req:NextRequest){return withMyday(req,async actor=>{
 const p=input.safeParse(await req.json().catch(()=>null));if(!p.success)return mydayJson({error:"Check the report details."},422);const v=p.data,client=await requireMydayClient(v.studentId,true);
 if(v.action==="generate")return mydayJson({error:"No approved AI summary integration is configured. Choose Write manually; your existing report is unchanged."},503);
 let pdf:Buffer;try{const docId=client.profilePhotoUrl?.split("document=")[1]?.split("&")[0],doc=docId?await prisma.documentRecord.findFirst({where:{id:docId,sourceType:"StudentPhoto",sourceId:client.id}}):null;
  pdf=mydayPdf({name:client.displayName,month:new Date(`${v.month}-01T12:00:00Z`).toLocaleDateString("en-GB",{month:"long",year:"numeric",timeZone:"Europe/London"}),content:v.content,logo:await sharp(await loadInvoiceLogo()).resize(640,640,{fit:"contain",background:"white"}).jpeg().toBuffer(),photo:doc?await sharp(await loadDocument(doc.storagePath)).resize(640,640,{fit:"cover"}).jpeg().toBuffer():undefined});
 }catch(e){return mydayJson({error:e instanceof MyDayPdfOverflow?e.message:e instanceof Error&&e.message.startsWith("The PDF contains")?e.message:"The report PDF could not be prepared. Your current report is unchanged."},422);}
 if(v.action==="preview")return new NextResponse(new Uint8Array(pdf),{headers:{"content-type":"application/pdf","cache-control":"private, no-store"}});
 await mydayTransaction(async tx=>{
  const current=await tx.myDayReport.findUnique({where:{studentId:v.studentId}});if((current?.version||0)!==v.version)throw new MyDayError("This report changed in another window. Reload before replacing it.",409);
  if(current?.edited&&!v.replaceConfirmed)throw new MyDayError(`Confirm replacing the edited ${current.month} report with ${v.month}.`,409);
  if(mydaySourceHash(await sourceRows(v.studentId,actor.organisationId,v.month))!==v.sourceHash)throw new MyDayError("Diary entries changed while this draft was open. Reload sources and review the wording before saving.",409);
  const data={organisationId:actor.organisationId,month:v.month,content:v.content,pdf:new Uint8Array(pdf),sourceHash:v.sourceHash,edited:true,updatedBy:actor.id};
  if(current){if(!(await tx.myDayReport.updateMany({where:{studentId:v.studentId,version:v.version},data:{...data,version:{increment:1}}})).count)throw new MyDayError("Report changed. Reload before saving.",409);}else await tx.myDayReport.create({data:{studentId:v.studentId,...data}});
  await tx.auditLog.create({data:{action:"MYDAY_REPORT_SAVED",actorType:"USER",actorId:actor.id,entityType:"Student",entityId:v.studentId,afterValue:{month:v.month,version:v.version+1}}});
 });return mydayJson({saved:true});
},true);}
