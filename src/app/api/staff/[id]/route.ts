import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/security";
import { staffUpdateSchema } from "@/lib/staff-input";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return withRole(req, "MANAGER", async () => {
    const { id } = await params;
    const staff = await prisma.staffMember.findUnique({
      where: { id },
      include: {
        credentials: { where: { kind: "PIN", active: true }, select: { id: true, createdAt: true } },
        clockEvents: { orderBy: { deviceTimestamp: "desc" }, take: 20, include: { device: { select: { name: true } } } },
      },
    });
    if (!staff) return jsonError("Staff member not found.", 404);
    return NextResponse.json({ ...staff, pinEnabled: staff.credentials.length > 0, credentials: undefined });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withRole(req, "MANAGER", async (user) => {
    const { id } = await params;
    const before = await prisma.staffMember.findUnique({ where: { id } });
    if (!before) return jsonError("Staff member not found.", 404);
    const parsed = staffUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Please check the staff details.", 422);
    const { pin, ...incoming } = parsed.data;
    if (pin) {
      const duplicate = await prisma.staffCredential.findFirst({
        where: { kind: "PIN", lookupHash: sha256(pin), active: true, staffId: { not: id } },
      });
      if (duplicate) return jsonError("That PIN cannot be used. Choose another.", 409);
    }
    const data = {
      ...incoming,
      ...(incoming.email ? { email: incoming.email.toLowerCase() } : {}),
      ...(incoming.startDate ? { startDate: new Date(incoming.startDate) } : {}),
      ...(incoming.endDate !== undefined ? { endDate: incoming.endDate ? new Date(incoming.endDate) : null } : {}),
      ...(incoming.active === false ? { archivedAt: new Date() } : incoming.active === true ? { archivedAt: null } : {}),
    };
    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.staffMember.update({ where: { id }, data });
      if (pin) {
        await tx.staffCredential.updateMany({ where: { staffId: id, kind: "PIN", active: true }, data: { active: false, revokedAt: new Date() } });
        await tx.staffCredential.create({ data: { staffId: id, kind: "PIN", lookupHash: sha256(pin), valueHash: await bcrypt.hash(pin, 12) } });
      }
      return updated;
    });
    const action = pin ? "STAFF_PIN_RESET" : before.active !== after.active ? (after.active ? "STAFF_RESTORED" : "STAFF_ARCHIVED") : "STAFF_UPDATED";
    await audit(action, {
      actorType: "USER", actorId: user.id, entityType: "StaffMember", entityId: id,
      beforeValue: before, afterValue: { ...after, pinReset: Boolean(pin) }, ...requestContext(req),
    });
    return NextResponse.json(after);
  });
}
