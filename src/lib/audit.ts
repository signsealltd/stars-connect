import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type AuditData = {
  actorType: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  beforeValue?: object;
  afterValue?: object;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
};

const safeJson = (value?: object) =>
  value ? (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue) : undefined;

export async function audit(action: string, data: AuditData) {
  try {
    await prisma.auditLog.create({
      data: {
        ...data,
        beforeValue: safeJson(data.beforeValue),
        afterValue: safeJson(data.afterValue),
        action,
      },
    });
  } catch (error) {
    console.error("Audit write failed", error);
  }
}
