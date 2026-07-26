import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { updateUserSchema } from "@/lib/user-input";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRole(req, "ADMINISTRATOR", async (actor) => {
    const { id } = await params;
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) return jsonError("Account not found.", 404);
    const parsed = updateUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Check the account details and password requirements.", 422);
    if (id === actor.id && (parsed.data.active === false || (parsed.data.role && parsed.data.role !== "ADMINISTRATOR"))) {
      return jsonError("You cannot remove your own administrator access.", 409);
    }
    const removesAdministrator = before.role === "ADMINISTRATOR" &&
      (parsed.data.active === false || (parsed.data.role && parsed.data.role !== "ADMINISTRATOR"));
    if (removesAdministrator && await prisma.user.count({ where: { role: "ADMINISTRATOR", active: true } }) <= 1) {
      return jsonError("At least one active administrator must remain.", 409);
    }
    if (parsed.data.email && parsed.data.email !== before.email &&
      await prisma.user.findUnique({ where: { email: parsed.data.email } })) {
      return jsonError("An account already uses that email address.", 409);
    }
    const { password, ...data } = parsed.data;
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      });
      if (password || data.active === false || data.role) await tx.session.deleteMany({ where: { userId: id } });
      return updated;
    });
    await audit("USER_UPDATED", {
      actorType: "USER", actorId: actor.id, entityType: "User", entityId: id,
      beforeValue: { name: before.name, email: before.email, role: before.role, active: before.active },
      afterValue: { name: user.name, email: user.email, role: user.role, active: user.active, passwordReset: Boolean(password) },
      ...requestContext(req),
    });
    return NextResponse.json(user);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRole(req, "ADMINISTRATOR", async (actor) => {
    const { id } = await params;
    if (id === actor.id) return jsonError("You cannot delete your own account.", 409);
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) return jsonError("Account not found.", 404);
    if (before.role === "ADMINISTRATOR" && before.active &&
      await prisma.user.count({ where: { role: "ADMINISTRATOR", active: true } }) <= 1) {
      return jsonError("At least one active administrator must remain.", 409);
    }
    const context = requestContext(req);
    await prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          action: "USER_DELETED", actorType: "USER", actorId: actor.id,
          entityType: "User", entityId: id,
          beforeValue: { name: before.name, email: before.email, role: before.role, active: before.active },
          ...context,
        },
      });
    });
    return NextResponse.json({ ok: true });
  });
}
