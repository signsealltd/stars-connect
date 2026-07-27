import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";
import { getOrganisationSettings } from "@/lib/organisation-settings";

const colour = z.string().regex(/^#[0-9a-f]{6}$/i);
const schema = z.object({
  organisationName: z.string().trim().min(2).max(120),
  organisationLegalName: z.string().trim().min(2).max(191),
  organisationAddress: z.string().trim().max(2000),
  organisationRegistrationNumber: z.string().trim().max(80),
  organisationLogoUrl: z.string().trim().max(250000),
  themePrimary: colour,
  themePrimaryDark: colour,
  themeAccent: colour,
});

export async function GET() {
  await requireRole("ADMINISTRATOR");
  return NextResponse.json(await getOrganisationSettings());
}

export async function PUT(req: NextRequest) {
  const user = await requireRole("ADMINISTRATOR");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the organisation and theme details." }, { status: 422 });
  const before = await getOrganisationSettings();
  await prisma.$transaction(Object.entries(parsed.data).map(([key, value]) =>
    prisma.appSetting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue, updatedBy: user.id },
      create: { key, value: value as Prisma.InputJsonValue, updatedBy: user.id },
    }),
  ));
  await audit("ORGANISATION_SETTINGS_CHANGED", { actorType: "USER", actorId: user.id, entityType: "AppSetting", beforeValue: before, afterValue: parsed.data, ...requestContext(req) });
  return NextResponse.json(parsed.data);
}
