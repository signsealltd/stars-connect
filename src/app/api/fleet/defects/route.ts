import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {transitionDefect} from "@/lib/fleet-service";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.FLEET_VIEW,async()=>{const q=req.nextUrl.searchParams;return NextResponse.json(await prisma.vehicleDefect.findMany({where:{...(q.get("vehicle")?{vehicleId:q.get("vehicle")!}:{}),...(q.get("status")?{status:q.get("status")!}:{}),...(q.get("severity")?{severity:q.get("severity")!}:{})},include:{vehicle:true,events:{orderBy:{createdAt:"asc"}}},orderBy:[{severity:"asc"},{createdAt:"desc"}],take:500}));});}
const schema=z.object({id:z.string().uuid(),status:z.enum(["UNDER_REVIEW","REPAIR_REQUIRED","REPAIRED","NO_FAULT","VERIFIED"]),notes:z.string().trim().min(3).max(4000),details:z.object({provider:z.string().max(191).optional(),cost:z.number().min(0).max(99999999).optional(),repairDate:z.string().date().optional(),verification:z.string().max(2000).optional(),documentId:z.string().uuid().optional()}).default({})});
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.FLEET_MANAGE,async user=>{const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Check the transition, notes and repair details.",422);try{return NextResponse.json(await transitionDefect(p.data.id,p.data.status,p.data.notes,p.data.details,user.id));}catch(e){return jsonError(e instanceof Error?e.message:"Unable to update defect.",409);}});}
