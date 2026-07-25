import { NextResponse } from "next/server";
import { getSession } from "@/lib/security";
export async function GET(){const session=await getSession();return session?NextResponse.json({id:session.user.id,name:session.user.name,role:session.user.role}):NextResponse.json({error:"Unauthorised"},{status:401})}
