import {NextRequest} from "next/server";
import {withStaff,staffJson} from "@/lib/staff-area-auth";
import {hrBaseline,submitHr} from "@/lib/staff-hr-service";
import {ownMedical} from "@/lib/staff-hr";
import {prisma} from "@/lib/prisma";
import {CAPABILITIES} from "@/lib/permission-catalog";
export async function GET(req:NextRequest){return withStaff(req,async i=>{const b=await prisma.$transaction(tx=>hrBaseline(tx,i.staff.id));await prisma.staffAccessEvent.create({data:{staffId:i.staff.id,actorId:i.user.id,action:"OWN_HR_READ",reason:"Staff viewed their own profile"}});return staffJson({personal:b.personal,medical:ownMedical(b.medical)})})}
export async function POST(req:NextRequest){return withStaff(req,async i=>{try{const request=await submitHr(i.staff.id,i.user,await req.json());return staffJson({id:request.id})}catch{return staffJson({error:"Check the proposed profile fields. Employment and management-only medical fields cannot be changed here."},422)}},CAPABILITIES.STAFF_OWN_REQUEST)}
