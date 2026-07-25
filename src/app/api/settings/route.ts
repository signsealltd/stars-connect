import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";

const schema = z.object({
  dailyEmailEnabled: z.boolean(),
  dailyEmailTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dailyEmailRecipients: z.array(z.email()).max(30),
  photoRetentionDays: z.number().int().min(1).max(3650),
  auditRetentionDays: z.number().int().min(30).max(3650),
  localHistoryDays: z.number().int().min(1).max(90),
  duplicateEventSeconds: z.number().int().min(5).max(300),
  cameraMode: z.enum(["DISABLED", "REQUIRED_ALL", "REQUIRED_SELECTED", "OPTIONAL"]),
});

const defaults = {
  dailyEmailEnabled: false,
  dailyEmailTime: "17:30",
  dailyEmailRecipients: [] as string[],
  photoRetentionDays: 30,
  auditRetentionDays: 365,
  localHistoryDays: 7,
  duplicateEventSeconds: 20,
  cameraMode: "OPTIONAL",
};

export async function GET(req: NextRequest) {
  return withRole(req, "ADMINISTRATOR", async () => {
    const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.keys(defaults) } } });
    const values = { ...defaults, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
    return NextResponse.json(values);
  });
}

export async function PUT(req: NextRequest) {
  return withRole(req, "ADMINISTRATOR", async (user) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Please check the settings.", 422);
    const beforeRows = await prisma.appSetting.findMany({ where: { key: { in: Object.keys(defaults) } } });
    const before = Object.fromEntries(beforeRows.map((r) => [r.key, r.value]));
    await prisma.$transaction(Object.entries(parsed.data).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value: value as Prisma.InputJsonValue, updatedBy: user.id },
        create: { key, value: value as Prisma.InputJsonValue, updatedBy: user.id },
      }),
    ));
    await audit("SETTINGS_CHANGED", { actorType: "USER", actorId: user.id, entityType: "AppSetting", beforeValue: before, afterValue: parsed.data, ...requestContext(req) });
    return NextResponse.json(parsed.data);
  });
}
