import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

const schema = z.object({staffId:z.string().uuid(),courseId:z.string().uuid(),required:z.boolean().nullable(),reason:z.string().trim().max(1000).default("")});

export async function POST(req: NextRequest) {
  return withRole(req, "MANAGER", async user => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Check the staff training assignment.",422);
    const {staffId,courseId,required,reason} = parsed.data;
    const [staff,course] = await Promise.all([
      prisma.staffMember.findFirst({where:{id:staffId,active:true,archivedAt:null},select:{id:true}}),
      prisma.trainingCourse.findFirst({where:{id:courseId,active:true},select:{id:true}}),
    ]);
    if(!staff || !course) return jsonError("Active staff member and course required.",404);
    const before = await prisma.staffTrainingAssignment.findUnique({where:{staffId_courseId:{staffId,courseId}}});
    const row = required === null
      ? await prisma.staffTrainingAssignment.deleteMany({where:{staffId,courseId}})
      : await prisma.staffTrainingAssignment.upsert({where:{staffId_courseId:{staffId,courseId}},create:{staffId,courseId,required,reason:reason||null,updatedById:user.id},update:{required,reason:reason||null,updatedById:user.id}});
    await audit("STAFF_TRAINING_ASSIGNMENT_UPDATED",{actorType:"USER",actorId:user.id,entityType:"StaffTrainingAssignment",beforeValue:before || undefined,afterValue:{staffId,courseId,required,reason},...requestContext(req)});
    return NextResponse.json(row);
  });
}
