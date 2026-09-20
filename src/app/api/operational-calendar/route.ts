import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import {audit} from "@/lib/audit";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_CALENDAR,async user=>NextResponse.json({canManage:hasCapability(user.role,CAPABILITIES.STAFF_RESOURCES_MANAGE,user.permissionOverrides),rows:await prisma.operationalTask.findMany({orderBy:{startDate:"desc"},take:500})}));}
const schema=z.object({id:z.string().uuid().optional(),title:z.string().trim().min(2).max(191),startDate:z.string().date(),endDate:z.string().date(),dueDate:z.string().date(),owner:z.string().max(120).optional(),notes:z.string().max(5000).optional(),status:z.enum(["OPEN","IN_PROGRESS","COMPLETED"]).default("OPEN")}).refine(d=>d.endDate>=d.startDate);
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_RESOURCES_MANAGE,async user=>{const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Check the task dates and title.",422);const {id,...d}=p.data,data={...d,startDate:new Date(d.startDate),endDate:new Date(d.endDate),dueDate:new Date(d.dueDate)};const row=id?await prisma.operationalTask.update({where:{id},data}):await prisma.operationalTask.create({data:{...data,createdById:user.id}});await audit("OPERATIONAL_TASK_SAVED",{actorType:"USER",actorId:user.id,entityType:"OperationalTask",entityId:row.id});return NextResponse.json(row)});}
