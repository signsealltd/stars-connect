import {NextRequest} from "next/server";
import {prisma} from "@/lib/prisma";
import {withMyday,mydayJson} from "@/lib/myday-auth";
import {myDayDate} from "@/lib/myday-rules";
export async function GET(req:NextRequest){return withMyday(req,async actor=>mydayJson({day:myDayDate(),notes:await prisma.myDayEntry.findMany({where:{organisationId:actor.organisationId,day:myDayDate(),handover:true},select:{id:true,studentId:true}})}));}
