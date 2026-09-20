import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {withCapability} from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
export async function GET(req:NextRequest){return withCapability(req,CAPABILITIES.STAFF_TRAINING,async user=>{const manager=hasCapability(user.role,CAPABILITIES.TRAINING_VIEW,user.permissionOverrides);return NextResponse.json(await prisma.staffTrainingRecord.findMany({where:{active:true,...(manager?{}:{staff:{userId:user.id}})},select:{id:true,courseName:true,completedDate:true,expiryDate:true,mandatory:true,staff:{select:{displayName:true}}},orderBy:{expiryDate:"asc"}}))});}
