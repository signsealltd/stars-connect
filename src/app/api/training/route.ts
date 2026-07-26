import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trainingSchema } from "@/lib/training-input";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";

const dates = (data: z.infer<typeof trainingSchema>) => ({ ...data, provider: data.provider || null, certificateReference: data.certificateReference || null, notes: data.notes || null, completedDate: new Date(`${data.completedDate}T00:00:00Z`), expiryDate: data.expiryDate ? new Date(`${data.expiryDate}T00:00:00Z`) : null });

export async function GET(req: NextRequest) { return withRole(req, "MANAGER", async () => {
  const includeArchived = req.nextUrl.searchParams.get("archived") === "true";
  const rows = await prisma.staffTrainingRecord.findMany({ where: includeArchived ? {} : { active: true }, include: { staff: { select: { firstName: true, lastName: true, displayName: true, active: true } } }, orderBy: [{ expiryDate: "asc" }, { completedDate: "desc" }] });
  return NextResponse.json(rows);
}); }
export async function POST(req: NextRequest) { return withRole(req, "MANAGER", async (user) => {
  const parsed = trainingSchema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return jsonError("Please check the training details.", 422);
  const row = await prisma.staffTrainingRecord.create({ data: { ...dates(parsed.data), createdById: user.id, updatedById: user.id } });
  await audit("STAFF_TRAINING_CREATED", { actorType: "USER", actorId: user.id, entityType: "StaffTrainingRecord", entityId: row.id, afterValue: row, ...requestContext(req) });
  return NextResponse.json(row, { status: 201 });
}); }