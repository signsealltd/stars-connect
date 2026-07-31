import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCapability, jsonError } from "@/lib/api";
import { CAPABILITIES } from "@/lib/permissions";
import { createScheduleException } from "@/lib/operations-service";
const schema=z.object({startDate:z.iso.date(),endDate:z.iso.date(),startTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),endTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),type:z.enum(["ANNUAL_LEAVE","SICKNESS","TRAINING","UNPAID_LEAVE","TEMPORARY_HOURS","OVERTIME","ADDITIONAL_SHIFT","SHIFT_SWAP","NON_WORKING_DAY","APPOINTMENT","OTHER"]),paid:z.boolean().optional(),notes:z.string().max(4000).optional(),replacementStaffId:z.uuid().optional()});
type Params={params:Promise<{id:string}>};
export async function POST(req:NextRequest,{params}:Params){return withCapability(req,CAPABILITIES.STAFF_SCHEDULE_MANAGE,async user=>{const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return jsonError("Please check the schedule exception.",422);try{return NextResponse.json(await createScheduleException(user,(await params).id,parsed.data),{status:201});}catch(error){return jsonError(error instanceof Error?error.message:"Request failed.",Number((error as {status?:number}).status??500));}});}
