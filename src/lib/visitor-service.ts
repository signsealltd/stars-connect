import { Prisma } from "@prisma/client";
import type { VisitorSignIn } from "./visitors";
import { isMeaningfulSignature, normalizeVisitorName, signaturePointCount, visitorSignInSchema, visitorSignOutSchema } from "./visitors";

type Tx = Prisma.TransactionClient;

export function publicVisitorPayload(payload: Record<string, unknown>) {
  const safe = { ...payload };
  delete safe.signature;
  delete safe.mobile;
  delete safe.email;
  delete safe.acceptedRulesText;
  return safe as Prisma.InputJsonValue;
}

export async function applyVisitorSignIn(tx: Tx, raw: Record<string, unknown>, deviceId: string) {
  const parsed = visitorSignInSchema.safeParse(raw);
  if (!parsed.success || !isMeaningfulSignature(parsed.success ? parsed.data.signature : [])) throw new Error("INVALID_VISITOR_SIGN_IN");
  const p: VisitorSignIn = parsed.data;
  const existing = await tx.visitorVisit.findUnique({ where: { id: p.id } });
  if (existing) return existing;
  const rules = await tx.visitorRuleSet.findUnique({ where: { id: p.ruleSetId } });
  if (!rules || rules.version !== p.ruleVersion || rules.rulesText !== p.acceptedRulesText) throw new Error("RULE_VERSION_MISMATCH");
  const reason = await tx.visitorReason.findUnique({ where: { id: p.reasonId } });
  if (!reason || reason.label !== p.reasonLabel) throw new Error("VISITOR_REASON_MISMATCH");
  const duplicate = await tx.visitorVisit.findFirst({
    where: { signedOutAt: null, visitor: { normalizedName: normalizeVisitorName(p.fullName) }, signedInAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
  });
  if (duplicate) throw new Error("DUPLICATE_ACTIVE_VISITOR");
  const retention = await tx.appSetting.findUnique({ where: { key: "visitorSignatureRetentionDays" } });
  const retentionDays = typeof retention?.value === "number" ? retention.value : 30;
  const visitor = await tx.visitor.upsert({
    where: { id: p.visitorId },
    update: { fullName: p.fullName, normalizedName: normalizeVisitorName(p.fullName), company: p.company || null, mobile: p.mobile || null, email: p.email || null },
    create: { id: p.visitorId, fullName: p.fullName, normalizedName: normalizeVisitorName(p.fullName), company: p.company || null, mobile: p.mobile || null, email: p.email || null },
  });
  return tx.visitorVisit.create({
    data: {
      id: p.id, visitorId: visitor.id, referenceCode: p.referenceCode, host: p.host,
      reasonId: p.reasonId, reasonLabel: p.reasonLabel, otherReason: p.otherReason || null,
      vehicleRegistration: p.vehicleRegistration || null, expectedDurationMinutes: p.expectedDurationMinutes,
      signedInAt: new Date(p.signedInAt), signInDeviceId: deviceId, emergencyIncluded: p.emergencyIncluded,
      acceptance: { create: { ruleSetId: p.ruleSetId, ruleVersion: p.ruleVersion, acceptedRulesText: p.acceptedRulesText, acceptedAt: new Date(p.acceptedAt) } },
      signature: { create: { strokeData: p.signature as Prisma.InputJsonValue, pointCount: signaturePointCount(p.signature), expiresAt: new Date(Date.now() + retentionDays * 86_400_000) } },
    },
  });
}

export async function applyVisitorSignOut(tx: Tx, raw: Record<string, unknown>, deviceId: string, userId?: string) {
  const parsed = visitorSignOutSchema.safeParse({ ...raw, signedOutByUserId: userId || raw.signedOutByUserId });
  if (!parsed.success) throw new Error("INVALID_VISITOR_SIGN_OUT");
  const visit = await tx.visitorVisit.findUnique({ where: { id: parsed.data.visitId } });
  if (!visit) throw new Error("VISITOR_NOT_FOUND");
  const departure = new Date(parsed.data.signedOutAt);
  if (visit.signedOutAt && visit.signedOutAt <= departure) return visit;
  if (departure < visit.signedInAt) throw new Error("INVALID_DEPARTURE_TIME");
  return tx.visitorVisit.update({ where: { id: visit.id }, data: { signedOutAt: departure, signOutDeviceId: deviceId, signedOutByUserId: parsed.data.signedOutByUserId, signOutCorrectionReason: parsed.data.correctionReason || null } });
}