import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const inlineBillingSchema = z.object({
  enabled: z.boolean().default(false),
  payerType: z.string().trim().min(1).max(40),
  payerName: z.string().trim().min(1).max(191),
  billingAddress: z.string().trim().min(1).max(2000),
  billingEmail: z.string().trim().email().optional().or(z.literal("")),
  activeFrom: z.string().date(),
  vatTreatment: z.enum(["OUTSIDE_SCOPE", "EXEMPT", "STANDARD", "ZERO_RATED"]),
  vatRate: z.number().min(0).max(100),
  rate: z.number().nonnegative(),
});

export const emergencyContactFields = {
  emergencyContactName: optionalText(120),
  emergencyContactRelationship: optionalText(80),
  emergencyContactPhone: optionalText(40),
  emergencyContactAlternativePhone: optionalText(40),
  emergencyContactEmail: z.string().trim().email().optional().or(z.literal("")),
  emergencyContactNotes: optionalText(2000),
};

export function nullableEmergencyContacts<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data };
  for (const key of Object.keys(emergencyContactFields)) {
    if (data[key] === "") Object.assign(result, { [key]: null });
  }
  return result;
}

export const directorRoles = new Set(["DIRECTOR", "ADMINISTRATOR"]);
