import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {randomUUID} from "crypto";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {careFields} from "@/lib/care-fields";
import {audit} from "@/lib/audit";
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){return withCapability(req,CAPABILITIES.STUDENT_CARE,async()=>{const {id}=await params;const student=await prisma.student.findUnique({where:{id},select:{careInformation:true,profilePhotoUrl:true}});if(!student)return jsonError("Student not found",404);return NextResponse.json({...student,rams:await prisma.staffResource.findMany({where:{studentId:id,category:"RAMS"},orderBy:{createdAt:"desc"},select:{id:true,title:true,status:true,version:true}})});});}
const schema=z.object({action:z.enum(["save","generate-rams"]),information:z.record(z.string().max(40),z.string().max(5000)).optional()});
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){return withCapability(req,CAPABILITIES.STUDENT_CARE_EDIT,async user=>{
 const {id}=await params,p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Check the care information.",422);
 const student=await prisma.student.findUnique({where:{id}});if(!student)return jsonError("Student not found",404);
 if(p.data.action==="save"){const information=Object.fromEntries(careFields.map(([key])=>[key,p.data.information?.[key]||""]));await prisma.student.update({where:{id},data:{careInformation:{...information,updatedAt:new Date().toISOString(),updatedBy:user.name}}});await audit("STUDENT_CARE_UPDATED",{actorType:"USER",actorId:user.id,entityType:"Student",entityId:id});return NextResponse.json({ok:true});}
 const info=student.careInformation as Record<string,string>|null;
 if(!info?.source?.trim())return jsonError("Save the returned information and its source before generating RAMS.",422);
 const sections=careFields.filter(([key])=>["source","consent","health","medication","mobility","behaviour","communication","hazards","controls","method","emergency","review"].includes(key));
 const content=[`Student: ${student.displayName}`,"Prepared from supplied information. Missing details must be confirmed before publication.",...sections.map(([key,label])=>`${label}\n${info[key]||"NOT PROVIDED — confirm with the information provider"}`)].join("\n\n");
 const row=await prisma.staffResource.create({data:{seriesId:randomUUID(),category:"RAMS",studentId:id,title:`RAMS — ${student.displayName}`,content,createdById:user.id}});
 await audit("STUDENT_RAMS_DRAFT_GENERATED",{actorType:"USER",actorId:user.id,entityType:"StaffResource",entityId:row.id});
 return NextResponse.json(row,{status:201});
});}
