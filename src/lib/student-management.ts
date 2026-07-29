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

export const optionalBillingProfileIdSchema = z.preprocess(
  value => value === "" || value === null ? undefined : value,
  z.string().uuid().optional(),
);
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

const fieldLabels:Record<string,string>={
  firstName:"first name",lastName:"surname",displayName:"display name",startDate:"start date",endDate:"end date",
  expectedDays:"expected attendance days",fundingCategory:"funding category",fundingOrganisation:"funding organisation",
  internalReference:"internal reference",notes:"manager notes",emergencyContactName:"emergency contact name",
  emergencyContactRelationship:"emergency contact relationship",emergencyContactPhone:"emergency contact telephone",
  emergencyContactAlternativePhone:"alternative emergency telephone",emergencyContactEmail:"emergency contact email",
  emergencyContactNotes:"emergency contact notes",billing:"billing setup",payerName:"billing payer name",
  billingAddress:"invoice address",billingEmail:"invoice email",activeFrom:"billing start date",rate:"billing rate",
};
export function studentValidationMessage(error:z.ZodError){
  const issue=error.issues[0],key=String(issue?.path.at(-1)||""),label=fieldLabels[key]||key;
  return label?`Check ${label}: ${issue?.message||"invalid value"}.`:"Please check the student details.";
}

export const directorRoles = new Set(["DIRECTOR", "ADMINISTRATOR"]);
