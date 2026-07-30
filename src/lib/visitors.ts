import { z } from "zod";

const safeText = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/[<>]/.test(value), "HTML characters are not allowed");
export const signaturePointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), t: z.number().nonnegative() });
export const signatureSchema = z.array(z.array(signaturePointSchema).min(2)).min(1).max(30);

export const visitorSignInSchema = z.object({
  id: z.uuid(),
  visitorId: z.uuid(),
  referenceCode: z.string().regex(/^[A-Z0-9]{6,12}$/),
  fullName: safeText(120),
  company: z.string().trim().max(191).refine((value) => !/[<>]/.test(value)).optional().default(""),
  host: z.string().trim().max(120).refine((value) => !/[<>]/.test(value)).optional().default(""),
  reasonId: z.uuid(),
  reasonLabel: safeText(100),
  otherReason: z.string().trim().max(250).refine((value) => !/[<>]/.test(value)).optional(),
  vehicleRegistration: z.string().trim().max(20).regex(/^[A-Za-z0-9 -]*$/).optional(),
  mobile: z.string().trim().max(40).regex(/^[0-9+() -]*$/).optional(),
  email: z.email().max(191).optional(),
  expectedDurationMinutes: z.number().int().min(5).max(1440).optional(),
  signedInAt: z.string().datetime(),
  ruleSetId: z.uuid(),
  ruleVersion: z.number().int().positive(),
  acceptedRulesText: z.string().min(10).max(20000),
  acceptedAt: z.string().datetime(),
  signature: signatureSchema,
  emergencyIncluded: z.boolean().default(true),
});

export const visitorSignOutSchema = z.object({
  visitId: z.uuid(),
  signedOutAt: z.string().datetime(),
  correctionReason: z.string().trim().max(500).optional(),
  signedOutByUserId: z.uuid().optional(),
});

export type VisitorSignIn = z.infer<typeof visitorSignInSchema>;
export type SignatureStrokeData = z.infer<typeof signatureSchema>;

export function appendSignatureStroke(existing: SignatureStrokeData, stroke: SignatureStrokeData[number]) {
  return [...existing, stroke];
}

export function normalizeVisitorName(value: string) { return value.trim().toLocaleLowerCase("en-GB").replace(/\s+/g, " "); }
export function createVisitReference() { return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(); }
export function signaturePointCount(strokes: SignatureStrokeData) { return strokes.reduce((sum, stroke) => sum + stroke.length, 0); }
export function isMeaningfulSignature(strokes: SignatureStrokeData) {
  if (signaturePointCount(strokes) < 8) return false;
  const points = strokes.flat();
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  return Math.max(...xs) - Math.min(...xs) >= 0.08 && Math.max(...ys) - Math.min(...ys) >= 0.025;
}
export function visitDurationMinutes(signedInAt: Date | string, signedOutAt?: Date | string | null) {
  if (!signedOutAt) return null;
  return Math.max(0, Math.round((new Date(signedOutAt).getTime() - new Date(signedInAt).getTime()) / 60000));
}
export function hasDuplicateActiveVisitor(visits: Array<{fullName:string;signedOutAt?:string}>, fullName:string) {
  const normalized=normalizeVisitorName(fullName);
  return visits.some((visit)=>!visit.signedOutAt&&normalizeVisitorName(visit.fullName)===normalized);
}
export function isRetentionExpired(createdAt:Date|string,days:number,now=new Date()) {
  return new Date(createdAt).getTime() + days * 86_400_000 <= now.getTime();
}