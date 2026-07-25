import { NextRequest,NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";
import { endSession,getSession } from "@/lib/security";
export async function POST(req:NextRequest){const session=await getSession();await endSession();if(session)await audit("USER_LOGGED_OUT",{actorType:"USER",actorId:session.userId,...requestContext(req)});return NextResponse.json({ok:true})}
