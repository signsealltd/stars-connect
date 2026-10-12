import {NextRequest,NextResponse} from "next/server";
import {withRole} from "@/lib/api";
import {trainingStatusData} from "@/lib/training-status-data";
export async function GET(req:NextRequest){return withRole(req,"MANAGER",async user=>NextResponse.json(await trainingStatusData(user.organisationId||"")));}
