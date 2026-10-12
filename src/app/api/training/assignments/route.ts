import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

const schema = z.object({staffId:z.string().uuid(),courseId:z.string().uuid(),required:z.boolean().nullable(),policy:z.object({renewalOverrideMonths:z.number().int().min(1).max(120).optional(),renewalOverrideDate:z.string().date().optional(),reassessmentAfter:z.string().date().optional(),bookedFor:z.string().date().optional(),reason:z.string().max(1000).optional(),clientPlans:z.array(z.object({clientId:z.string().min(1).max(191),planId:z.string().min(1).max(191),version:z.string().min(1).max(100)})).max(100).optional()}).optional(),reason:z.string().trim().max(1000).default("")});

export async function POST(req: NextRequest) {
  return withRole(req, "MANAGER", async user => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Check the staff training assignment.",422);
    const {staffId,courseId,required,reason,policy} = parsed.data;
    if(required===null&&policy&&Object.values(policy).some(value=>Array.isArray(value)?value.length>0:!!value))return jsonError("Choose Required or Not required to save individual policy settings.",422);
    const [staff,course] = await Promise.all([
      prisma.staffMember.findFirst({where:{id:staffId,active:true,archivedAt:null},select:{id:true}}),
      prisma.trainingCourse.findFirst({where:{id:courseId,active:true},select:{id:true}}),
    ]);
    if(!staff || !course) return jsonError("Active staff member and course required.",404);
    if(policy&&(policy.renewalOverrideMonths||policy.renewalOverrideDate||policy.reassessmentAfter)&&!reason.trim())return jsonError("Give a reason for this individual override or reassessment.",422);
    const before = await prisma.staffTrainingAssignment.findUnique({where:{staffId_courseId:{staffId,courseId}}});
    const row = required === null
      ? await prisma.staffTrainingAssignment.deleteMany({where:{staffId,courseId}})
      : await prisma.staffTrainingAssignment.upsert({where:{staffId_courseId:{staffId,courseId}},create:{staffId,courseId,required,policy,reason:reason||null,updatedById:user.id},update:{required,policy,reason:reason||null,updatedById:user.id}});
    await audit("STAFF_TRAINING_ASSIGNMENT_UPDATED",{actorType:"USER",actorId:user.id,entityType:"StaffTrainingAssignment",beforeValue:before || undefined,afterValue:{staffId,courseId,required,reason,policy},...requestContext(req)});
    return NextResponse.json(row);
  });
}
