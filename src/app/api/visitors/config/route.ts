import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateDevice } from "@/lib/device-auth";

export async function GET(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) return NextResponse.json({ error: "This tablet is not authorised." }, { status: 401 });
  const [reasons, rules, settings] = await Promise.all([
    prisma.visitorReason.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.visitorRuleSet.findFirst({ where: { active: true }, orderBy: { version: "desc" } }),
    prisma.appSetting.findMany({ where: { key: { in: ["visitorCompanyRequired","visitorMobileRequired","visitorVehicleRequired","visitorDurationRequired"] } } }),
  ]);
  if (!rules) return NextResponse.json({ error: "Visitor site rules have not been configured." }, { status: 503 });
  const configured = Object.fromEntries(settings.map((row) => [row.key, row.value]));
  return NextResponse.json({
    reasons: reasons.map(({ id, label, sortOrder }) => ({ id, label, sortOrder })),
    rules: { id: rules.id, version: rules.version, title: rules.title, rulesText: rules.rulesText },
    required: { company: configured.visitorCompanyRequired === true, mobile: configured.visitorMobileRequired === true, vehicle: configured.visitorVehicleRequired === true, duration: configured.visitorDurationRequired === true },
  });
}