import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/security";

const staffSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(120),
  email: z.email().max(191),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  jobRole: z.string().trim().min(1).max(100),
  profilePhotoUrl: z.string().max(250000).nullable().optional(),
  startDate: z.string().date(),
  endDate: z.string().date().optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  contractedWeeklyHours: z.number().min(0).max(168).nullable().optional(),
  hourlyRate: z.number().min(0).max(10000).nullable().optional(),
  payrollNumber: z.string().trim().max(80).nullable().optional().or(z.literal("")),
  clockingEnabled: z.boolean().default(true),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
});

export async function GET(req: NextRequest) {
  return withRole(req, "MANAGER", async () => {
    const status = req.nextUrl.searchParams.get("status") || "active";
    const search = req.nextUrl.searchParams.get("search")?.trim();
    const rows = await prisma.staffMember.findMany({
      where: {
        ...(status === "active" ? { active: true } : status === "archived" ? { active: false } : {}),
        ...(search ? { OR: [
          { displayName: { contains: search } },
          { email: { contains: search } },
          { jobRole: { contains: search } },
        ] } : {}),
      },
      include: { credentials: { where: { kind: "PIN", active: true }, select: { id: true } } },
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
    });
    return NextResponse.json(rows.map(({ credentials, ...row }) => ({ ...row, pinEnabled: credentials.length > 0 })));
  });
}

export async function POST(req: NextRequest) {
  return withRole(req, "MANAGER", async (user) => {
    const parsed = staffSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Please check the staff details.", 422);
    const { pin, ...data } = parsed.data;
    if (pin) {
      const duplicate = await prisma.staffCredential.findFirst({
        where: { kind: "PIN", lookupHash: sha256(pin), active: true },
      });
      if (duplicate) return jsonError("That PIN cannot be used. Choose another.", 409);
    }
    const staff = await prisma.$transaction(async (tx) => {
      const created = await tx.staffMember.create({
        data: {
          ...data,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          notes: data.notes || null,
          payrollNumber: data.payrollNumber || null,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
        },
      });
      if (pin) await tx.staffCredential.create({
        data: {
          staffId: created.id,
          kind: "PIN",
          lookupHash: sha256(pin),
          valueHash: await bcrypt.hash(pin, 12),
        },
      });
      return created;
    });
    await audit("STAFF_CREATED", {
      actorType: "USER", actorId: user.id, entityType: "StaffMember", entityId: staff.id,
      afterValue: { ...staff, pinConfigured: Boolean(pin) }, ...requestContext(req),
    });
    return NextResponse.json(staff, { status: 201 });
  });
}

