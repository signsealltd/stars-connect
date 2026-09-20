import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Student } from "@prisma/client";
import { z } from "zod";

export const REVIEW_TOKEN_BYTES = 32;
export const REVIEW_LOCK_MINUTES = 15;
export const REVIEW_MAX_VERIFICATION_FAILURES = 5;

export const reviewFieldDefinitions = [
  ["firstName", "Client details", true], ["lastName", "Client details", true],
  ["displayName", "Client details", false], ["dateOfBirth", "Client details", true],
  ["addressLine1", "Client details", false], ["addressLine2", "Client details", false],
  ["town", "Client details", false], ["postcode", "Client details", false],
  ["phone", "Client details", false], ["email", "Client details", false],
  ["nhsNumber", "Client details", true], ["hospitalNumber", "Client details", true],
  ["emergencyContactName", "Emergency contacts", true],
  ["emergencyContactRelationship", "Emergency contacts", true],
  ["emergencyContactPhone", "Emergency contacts", true],
  ["emergencyContactAlternativePhone", "Emergency contacts", false],
  ["emergencyContactEmail", "Emergency contacts", false],
  ["emergencyContactNotes", "Emergency contacts", false],
  ["secondaryEmergencyContact", "Emergency contacts", true],
  ["gpName", "Medical", true], ["gpSurgery", "Medical", true], ["gpPhone", "Medical", true],
  ["medicalProfile", "Medical", true], ["personCentredProfile", "Person-centred profile", false],
  ["consents", "Consents", true], ["billing", "Billing", true],
] as const;

export type ReviewFieldKey = typeof reviewFieldDefinitions[number][0];
export type ReviewAnswers = Record<string, unknown>;

const optionalText = z.string().trim().max(4000).optional().nullable();
const shortOptionalText = z.string().trim().max(191).optional().nullable();
const repeatableText = z.union([
  z.string().trim().max(4000),
  z.array(z.string().trim().max(1000)).max(30),
]);
const medicationList = z.union([
  z.string().trim().max(4000),
  z.array(z.object({
    name: z.string().trim().max(191),
    frequency: z.string().trim().max(191).default(""),
    dosage: z.string().trim().max(191).default(""),
  })).max(30),
]);
const consentChoice = z.enum(["YES", "NO", "OTHER"]);
const photographyConsent = z.union([
  z.boolean(),
  z.object({
    internalCareRecords: z.boolean().default(false),
    website: z.boolean().default(false),
    socialMedia: z.boolean().default(false),
    printedMaterials: z.boolean().default(false),
    newslettersDisplays: z.boolean().default(false),
    pressReleases: z.boolean().default(false),
    promotionalVideos: z.boolean().default(false),
    none: z.boolean().default(false),
  }),
]);
export const reviewAnswersSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(120),
  dateOfBirth: z.string().trim().max(10).optional().nullable(),
  addressLine1: optionalText, addressLine2: optionalText, town: optionalText, postcode: optionalText,
  phone: optionalText, email: z.union([z.literal(""), z.string().email().max(191)]).optional().nullable(),
  nhsNumber: optionalText, hospitalNumber: optionalText,
  emergencyContactName: optionalText, emergencyContactRelationship: optionalText,
  emergencyContactPhone: optionalText, emergencyContactAlternativePhone: optionalText,
  emergencyContactEmail: z.union([z.literal(""), z.string().email().max(191)]).optional().nullable(),
  emergencyContactNotes: optionalText,
  secondaryEmergencyContact: z.record(z.string(), z.unknown()).optional().nullable(),
  gpName: optionalText, gpSurgery: optionalText, gpPhone: optionalText,
  medicalProfile: z.object({
    conditions: repeatableText.optional(),
    allergies: repeatableText.optional(),
    emergencyMedication: medicationList.optional(),
    currentMedication: medicationList.optional(),
    instructions: optionalText,
  }).passthrough().optional().nullable(),
  personCentredProfile: z.record(z.string(), z.unknown()).optional().nullable(),
  consents: z.object({
    photography: photographyConsent.optional(),
    localTrips: z.union([z.boolean(), consentChoice]).optional(),
    localTripsOther: optionalText,
    transport: z.boolean().optional(),
    emergencyTreatment: z.boolean().optional(),
    informationSharing: z.boolean().optional(),
  }).passthrough().optional().default({}),
  billing: z.object({
    payerType: z.string().trim().max(191).optional(),
    payerName: shortOptionalText,
    email: z.union([z.literal(""), z.string().email().max(191)]).optional().nullable(),
    phone: shortOptionalText,
    address: optionalText,
    reference: shortOptionalText,
  }).passthrough().optional().default({}),
});

export const reviewDeclarationSchema = z.object({
  declarationName: z.string().trim().min(2).max(120),
  declarationCapacity: z.string().trim().min(2).max(120),
  signatureData: z.string().max(250_000).optional().nullable(),
  accepted: z.literal(true),
});

export function createReviewToken() {
  const token = randomBytes(REVIEW_TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashReviewToken(token) };
}

export function hashReviewToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenHashesMatch(token: string, expectedHash: string) {
  const actual = Buffer.from(hashReviewToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const jsonValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value ?? null;
};

export function studentReviewSnapshot(student: Student): ReviewAnswers {
  return Object.fromEntries(reviewFieldDefinitions.map(([key]) => [key, jsonValue((student as unknown as Record<string, unknown>)[key])]));
}

const equal = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

export function buildChangeProposals(current: ReviewAnswers, submitted: ReviewAnswers) {
  return reviewFieldDefinitions.flatMap(([fieldKey, category, critical]) => equal(current[fieldKey], submitted[fieldKey]) ? [] : [{
    fieldKey, category, critical, currentValue: current[fieldKey] ?? null, submittedValue: submitted[fieldKey] ?? null,
  }]);
}

export function publicReviewState(input: { status: string; expiresAt: Date; revokedAt?: Date | null; lockedUntil?: Date | null }, now = new Date()) {
  if (input.revokedAt || input.status === "REVOKED") return "REVOKED" as const;
  if (input.expiresAt <= now || input.status === "EXPIRED") return "EXPIRED" as const;
  if (input.lockedUntil && input.lockedUntil > now) return "LOCKED" as const;
  if (["SUBMITTED", "UNDER_REVIEW", "PARTIALLY_APPROVED", "COMPLETED"].includes(input.status)) return "SUBMITTED" as const;
  return "OPEN" as const;
}

export function safeReviewLink(token: string) {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/review/${encodeURIComponent(token)}`;
}

export function reviewExpiry(days = 21) {
  const date = new Date(); date.setDate(date.getDate() + days); return date;
}
