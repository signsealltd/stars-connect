import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.FLEET_VIEW,async()=>NextResponse.json(await prisma.vehicleMaintenance.findMany({where:req.nextUrl.searchParams.get("vehicle")?{vehicleId:req.nextUrl.searchParams.get("vehicle")!}:{},include:{vehicle:true},orderBy:{performedAt:"desc"},take:500})));}
const schema=z.object({vehicleId:z.string().uuid(),performedAt:z.string().date(),provider:z.string().trim().min(1).max(191),notes:z.string().trim().min(3).max(5000),cost:z.number().min(0).max(99999999).optional()});
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.FLEET_MANAGE,async user=>{const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Check maintenance details.",422);return NextResponse.json(await prisma.$transaction(async tx=>{const row=await tx.vehicleMaintenance.create({data:{...p.data,performedAt:new Date(p.data.performedAt),userId:user.id}});await tx.auditLog.create({data:{action:"VEHICLE_MAINTENANCE_RECORDED",actorType:"USER",actorId:user.id,entityType:"VehicleMaintenance",entityId:row.id,afterValue:JSON.parse(JSON.stringify(row))}});return row;}));});}
