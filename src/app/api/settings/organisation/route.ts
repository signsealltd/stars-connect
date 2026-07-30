import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";
import { getOrganisationSettings } from "@/lib/organisation-settings";
import { isThemePreset, themePresets } from "@/lib/theme-presets";

const logoSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().max(250000),
});

const schema = z.object({
  organisationName: z.string().trim().min(2).max(120),
  organisationLegalName: z.string().trim().min(2).max(191),
  organisationAddress: z.string().trim().max(2000),
  organisationLogoUrl: z.string().trim().max(250000),
  organisationLogos: z.array(logoSchema).min(1).max(5),
  themePreset: z.string(),
});

export async function GET() {
  await requireRole("ADMINISTRATOR");
  return NextResponse.json(await getOrganisationSettings());
}

export async function PUT(req: NextRequest) {
  const user = await requireRole("ADMINISTRATOR");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the organisation and theme details." }, { status: 422 });
  if (!isThemePreset(parsed.data.themePreset)) {
    return NextResponse.json({ error: "Please choose one of the available themes." }, { status: 422 });
  }
  if (!parsed.data.organisationLogos.some((logo) => logo.url === parsed.data.organisationLogoUrl)) {
    return NextResponse.json({ error: "Please select one of the saved organisation logos." }, { status: 422 });
  }
  const preset = themePresets[parsed.data.themePreset];
  const settings = { ...parsed.data, themePrimary: preset.primary, themePrimaryDark: preset.header, themeAccent: preset.accent };
  const before = await getOrganisationSettings();
  await prisma.$transaction([
    ...Object.entries(settings).map(([key, value]) => prisma.appSetting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue, updatedBy: user.id },
      create: { key, value: value as Prisma.InputJsonValue, updatedBy: user.id },
    })),
    prisma.appSetting.upsert({
      where: { key: "logoUrl" },
      update: { value: settings.organisationLogoUrl, updatedBy: user.id },
      create: { key: "logoUrl", value: settings.organisationLogoUrl, updatedBy: user.id },
    }),
  ]);
  await audit("ORGANISATION_SETTINGS_CHANGED", { actorType: "USER", actorId: user.id, entityType: "AppSetting", beforeValue: before, afterValue: settings, ...requestContext(req) });
  return NextResponse.json(settings);
}
