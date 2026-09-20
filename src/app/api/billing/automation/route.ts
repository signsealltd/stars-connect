import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
import {audit} from "@/lib/audit";
const schema=z.object({enabled:z.boolean(),startMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)});
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_REVIEW,async()=>{const row=await prisma.appSetting.findUnique({where:{key:"monthlyFundedBilling"}});return NextResponse.json(row?.value||{enabled:false,startMonth:new Date().toISOString().slice(0,7)})});}
export async function POST(req:NextRequest){return withCapability(req,CAPABILITIES.BILLING_APPROVE,async user=>{const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return jsonError("Select an activation month.",422);await prisma.appSetting.upsert({where:{key:"monthlyFundedBilling"},update:{value:p.data,updatedBy:user.id},create:{key:"monthlyFundedBilling",value:p.data,updatedBy:user.id}});await audit("MONTHLY_FUNDED_BILLING_CONFIGURED",{actorType:"USER",actorId:user.id,afterValue:p.data});return NextResponse.json(p.data)});}
