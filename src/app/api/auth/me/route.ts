import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/security";
export async function GET(){const session=await getSession();return session?NextResponse.json({id:session.user.id,name:session.user.name,role:session.user.role,capabilities:Object.values(CAPABILITIES).filter(c=>hasCapability(session.user.role,c,session.user.permissionOverrides))}):NextResponse.json({error:"Unauthorised"},{status:401})}
