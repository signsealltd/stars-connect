import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { createUserSchema } from "@/lib/user-input";
import { audit } from "@/lib/audit";

const publicUser = {
  id: true, name: true, email: true, role: true, active: true, permissionOverrides:true, createdAt: true,
} as const;

export async function GET(req: NextRequest) {
  return withRole(req, "ADMINISTRATOR", async () =>
    NextResponse.json(await prisma.user.findMany({
      select: publicUser,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    })),
  );
}

export async function POST(req: NextRequest) {
  return withRole(req, "ADMINISTRATOR", async (actor) => {
    const parsed = createUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Check the account details.", 422);
    if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) {
      return jsonError("An account already uses that email address.", 409);
    }
    const { password, permissionOverrides, ...data } = parsed.data;
    const user = await prisma.user.create({
      data: { ...data, permissionOverrides:permissionOverrides||{}, passwordHash: await bcrypt.hash(password, 12) },
      select: publicUser,
    });
    await audit("USER_CREATED", {
      actorType: "USER", actorId: actor.id, entityType: "User", entityId: user.id,
      afterValue: { name: user.name, email: user.email, role: user.role, active: user.active, permissionsCustomised:Boolean(Object.keys(permissionOverrides||{}).length) },
      ...requestContext(req),
    });
    return NextResponse.json(user, { status: 201 });
  });
}
