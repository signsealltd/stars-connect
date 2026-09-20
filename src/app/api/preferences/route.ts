import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getUserPreferences, quickActionOptions } from "@/lib/user-preferences";

import {moduleCapability} from "@/lib/module-access";
import {hasCapability} from "@/lib/permissions";
import {mutationOriginAllowed} from "@/lib/api";

const schema = z.object({
  colourMode: z.enum(["light", "dark", "system"]),
  quickActions: z.array(z.enum(quickActionOptions.map((item) => item.id) as [string, ...string[]])).min(1).max(12),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  return NextResponse.json({ ...(await getUserPreferences(session.userId)), options: quickActionOptions.filter(option=>{const cap=moduleCapability(option.href);return cap&&hasCapability(session.user.role,cap,session.user.permissionOverrides)}) });
}

export async function PUT(req: NextRequest) {
  if(!mutationOriginAllowed(req))return NextResponse.json({error:"Request origin was rejected."},{status:403});
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the display preferences." }, { status: 422 });
  await prisma.appSetting.upsert({
    where: { key: `userPreferences:${session.userId}` },
    update: { value: parsed.data as Prisma.InputJsonValue, updatedBy: session.userId },
    create: { key: `userPreferences:${session.userId}`, value: parsed.data as Prisma.InputJsonValue, updatedBy: session.userId },
  });
  return NextResponse.json(parsed.data);
}
