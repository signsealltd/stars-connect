import { z } from "zod";

const optionalText = (maximum = 4000) => z.string().trim().max(maximum).optional().or(z.literal(""));

export const secondaryEmergencyContactSchema = z.object({
  name: optionalText(120),
  relationship: optionalText(80),
  phone: optionalText(40),
  email: z.union([z.literal(""), z.string().email().max(191)]).optional(),
});

export const medicalProfileSchema = z.object({
  conditions: z.union([optionalText(), z.array(z.string().trim().max(1000)).max(30)]),
  allergies: z.union([optionalText(), z.array(z.string().trim().max(1000)).max(30)]),
  emergencyMedication: z.union([optionalText(), z.array(z.object({ name: z.string().trim().max(191), frequency: optionalText(191), dosage: optionalText(191) })).max(30)]),
  currentMedication: z.union([optionalText(), z.array(z.object({ name: z.string().trim().max(191), frequency: optionalText(191), dosage: optionalText(191) })).max(30)]),
  instructions: optionalText(),
});

export const personCentredProfileSchema = z.object({
  communication: optionalText(),
  supportStrategies: optionalText(),
  interests: optionalText(),
  dislikes: optionalText(),
  triggers: optionalText(),
  calmingStrategies: optionalText(),
  goals: optionalText(),
});

export const studentProfileFields = {
  dateOfBirth: z.string().date().optional().or(z.literal("")),
  addressLine1: optionalText(191), addressLine2: optionalText(191), town: optionalText(120), postcode: optionalText(20),
  phone: optionalText(40), email: z.union([z.literal(""), z.string().email().max(191)]).optional(),
  nhsNumber: optionalText(32), hospitalNumber: optionalText(64),
  gpName: optionalText(120), gpSurgery: optionalText(191), gpPhone: optionalText(40),
  secondaryEmergencyContact: secondaryEmergencyContactSchema.optional(),
  medicalProfile: medicalProfileSchema.optional(),
  personCentredProfile: personCentredProfileSchema.optional(),
};

export function nullableProfileText<T extends Record<string, unknown>>(input: T): T {
  const textKeys = ["addressLine1", "addressLine2", "town", "postcode", "phone", "email", "nhsNumber", "hospitalNumber", "gpName", "gpSurgery", "gpPhone"];
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, textKeys.includes(key) && value === "" ? null : value])) as T;
}

export function latestConsentValues(items: Array<{ consentType: string; newValue: unknown }>) {
  const result: Record<string, unknown> = {};
  for (const item of items) if (!(item.consentType in result)) result[item.consentType] = item.newValue;
  return result;
}
