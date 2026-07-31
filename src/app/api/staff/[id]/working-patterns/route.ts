import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCapability, jsonError } from "@/lib/api";
import { CAPABILITIES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireOrganisation } from "@/lib/compliance-service";
import { createWorkingPattern } from "@/lib/operations-service";
const schema=z.object({name:z.string().min(1).max(120),effectiveStart:z.iso.date(),effectiveEnd:z.iso.date().optional(),timezone:z.string().max(80).default("Europe/London"),cycleWeeks:z.number().int().min(1).max(8).default(1),notes:z.string().max(4000).optional(),intervals:z.array(z.object({weekIndex:z.number().int().min(1).max(8),dayOfWeek:z.number().int().min(0).max(6),startTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),endTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),breakMinutes:z.number().int().min(0).max(720).default(0),premisesName:z.string().max(191).optional(),defaultRole:z.string().max(100).optional()} )).min(1).max(112)}).refine(v=>!v.effectiveEnd||v.effectiveEnd>=v.effectiveStart,{message:"Effective end must not precede start."});
type Params={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:Params){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_VIEW,async user=>{const{id}=await params,organisationId=requireOrganisation(user);const patterns=await prisma.staffWorkingPattern.findMany({where:{organisationId,staffId:id},include:{intervals:true},orderBy:[{version:"desc"}]});return NextResponse.json({patterns});});}
export async function POST(req:NextRequest,{params}:Params){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_MANAGE,async user=>{const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Please check the working pattern.",422);try{return NextResponse.json(await createWorkingPattern(user,(await params).id,parsed.data),{status:201});}catch(error){return jsonError(error instanceof Error?error.message:"Request failed.",Number((error as {status?:number}).status??500));}});}
