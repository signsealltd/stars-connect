import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trainingSchema } from "@/lib/training-input";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import {CAPABILITIES,hasCapability} from "@/lib/permissions";
import { audit } from "@/lib/audit";

const dates = (data: z.infer<typeof trainingSchema>) => ({ ...data, provider: data.provider || null, certificateReference: data.certificateReference || null, notes: data.notes || null, completedDate: new Date(`${data.completedDate}T00:00:00Z`), expiryDate: data.expiryDate ? new Date(`${data.expiryDate}T00:00:00Z`) : null });

export async function GET(req: NextRequest) { return withRole(req, "MANAGER", async (user) => {
  const includeArchived = req.nextUrl.searchParams.get("archived") === "true";
  const rows = await prisma.staffTrainingRecord.findMany({ where: includeArchived ? {} : { active: true }, include: { staff: { select: { firstName: true, lastName: true, displayName: true, active: true } }, course:true, trainingProvider:true }, orderBy: [{ expiryDate: "asc" }, { completedDate: "desc" }] });
  const evidence=hasCapability(user.role,CAPABILITIES.STAFF_HR_DOCUMENTS,user.permissionOverrides)?await prisma.staffPrivateDocument.findMany({where:{staffId:{in:(await prisma.staffMember.findMany({where:{userId:{in:(await prisma.user.findMany({where:{organisationId:user.organisationId},select:{id:true}})).map(u=>u.id)}},select:{id:true}})).map(s=>s.id)},trainingRecordId:{in:rows.map(r=>r.id)},expiresAt:{gt:new Date()}},select:{id:true,filename:true,trainingRecordId:true}}):[];
  return NextResponse.json(rows.map(row=>({...row,documents:evidence.filter(d=>d.trainingRecordId===row.id)})));
}); }
export async function POST(req: NextRequest) { return withRole(req, "MANAGER", async (user) => {
  const parsed = trainingSchema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return jsonError("Please check the training details.", 422);
  const row = await prisma.staffTrainingRecord.create({ data: { ...dates(parsed.data), createdById: user.id, updatedById: user.id } });
  await audit("STAFF_TRAINING_CREATED", { actorType: "USER", actorId: user.id, entityType: "StaffTrainingRecord", entityId: row.id, afterValue: row, ...requestContext(req) });
  return NextResponse.json(row, { status: 201 });
}); }
