import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/security";

type Params = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), name: z.string().trim().min(2).max(120) }),
  z.object({ action: z.literal("revoke") }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("rotate") }),
]);

export async function PATCH(req: NextRequest, { params }: Params) {
  return withRole(req, "ADMINISTRATOR", async (user) => {
    const { id } = await params;
    const before = await prisma.device.findUnique({ where: { id } });
    if (!before) return jsonError("Device not found.", 404);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Invalid device action.", 422);
    let token: string | undefined;
    const data = parsed.data.action === "rename" ? { name: parsed.data.name }
      : parsed.data.action === "revoke" ? { status: "REVOKED" as const, revokedAt: new Date() }
      : parsed.data.action === "restore" ? { status: "ACTIVE" as const, revokedAt: null }
      : (() => { token = randomBytes(32).toString("base64url"); return { tokenHash: sha256(token), tokenRotatedAt: new Date(), status: "ACTIVE" as const, revokedAt: null }; })();
    const after = await prisma.device.update({ where: { id }, data });
    const action = parsed.data.action === "rotate" ? "DEVICE_TOKEN_ROTATED" : `DEVICE_${parsed.data.action.toUpperCase()}`;
    await audit(action, {
      actorType: "USER", actorId: user.id, entityType: "Device", entityId: id,
      beforeValue: { name: before.name, status: before.status },
      afterValue: { name: after.name, status: after.status }, ...requestContext(req),
    });
    return NextResponse.json({
      device: { id: after.id, name: after.name, status: after.status },
      ...(token ? { token, setupCode: `${after.id}.${token}` } : {}),
    });
  });
}
