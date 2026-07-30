import type { Prisma, PrismaClient } from "@prisma/client";

type Client = Prisma.TransactionClient | PrismaClient;

export const defaultVisitorReasons = [
  "Electrical",
  "Fire safety",
  "Plumbing",
  "Maintenance",
  "Delivery",
  "Contractor",
  "Professional visit",
  "Personal visit",
  "Meeting",
  "Other",
] as const;

export const defaultVisitorRules = {
  title: "Visitor site rules",
  rulesText: "Please remain with your host unless instructed otherwise. Follow all fire, emergency and safeguarding instructions. Do not photograph or record people on site. Report hazards immediately and wear any required protective equipment. Sign out before leaving the site.",
};

const defaultSettings = {
  visitorCompanyRequired: false,
  visitorMobileRequired: false,
  visitorVehicleRequired: false,
  visitorDurationRequired: false,
  visitorRecordRetentionDays: 730,
  visitorSignatureRetentionDays: 30,
  visitorPhoneRetentionDays: 30,
} as const;

export async function ensureVisitorConfiguration(client: Client) {
  const activeReasons = await client.visitorReason.count({ where: { active: true } });
  if (!activeReasons) {
    for (const [sortOrder, label] of defaultVisitorReasons.entries()) {
      await client.visitorReason.upsert({
        where: { label },
        update: { sortOrder, active: true },
        create: { label, sortOrder, active: true },
      });
    }
  }

  let rules = await client.visitorRuleSet.findFirst({ where: { active: true }, orderBy: { version: "desc" } });
  if (!rules) {
    const latest = await client.visitorRuleSet.findFirst({ orderBy: { version: "desc" } });
    rules = latest
      ? await client.visitorRuleSet.update({ where: { id: latest.id }, data: { active: true } })
      : await client.visitorRuleSet.upsert({
          where: { version: 1 },
          update: { active: true },
          create: { version: 1, ...defaultVisitorRules, active: true },
        });
  }

  for (const [key, value] of Object.entries(defaultSettings)) {
    await client.appSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  return rules;
}
