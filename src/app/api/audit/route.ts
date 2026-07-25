import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api";
export async function GET(req:NextRequest){return withRole(req,"ADMINISTRATOR",async()=>NextResponse.json(await prisma.auditLog.findMany({orderBy:{createdAt:"desc"},take:500})))}
