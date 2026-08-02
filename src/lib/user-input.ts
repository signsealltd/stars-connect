import { z } from "zod";
import { CAPABILITIES } from "./permissions";

export const roles = ["ADMINISTRATOR", "DIRECTOR", "MANAGER", "RECEPTION"] as const;
const capabilityKeys=Object.values(CAPABILITIES) as [string,...string[]];
const permissionOverrides=z.record(z.enum(capabilityKeys),z.boolean()).optional();
export const usernameSchema=z.string().trim().toLowerCase().min(3,"Username must be at least 3 characters.").max(32).regex(/^[a-z0-9][a-z0-9._-]*$/,"Use letters, numbers, dots, dashes or underscores only.");
const optionalEmail=z.union([z.literal(""),z.email().max(191)]).transform(value=>value?value.toLowerCase():null);

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: usernameSchema,
  email: optionalEmail,
  role: z.enum(roles),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, "Password needs a lowercase letter.")
    .regex(/[A-Z]/, "Password needs an uppercase letter.")
    .regex(/\d/, "Password needs a number."),
  permissionOverrides,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  username: usernameSchema.optional(),
  email: optionalEmail.optional(),
  role: z.enum(roles).optional(),
  active: z.boolean().optional(),
  password: z.string().min(12, "Password must be at least 12 characters.").max(128)
    .regex(/[a-z]/, "Password needs a lowercase letter.")
    .regex(/[A-Z]/, "Password needs an uppercase letter.")
    .regex(/\d/, "Password needs a number.")
    .optional(),
  permissionOverrides,
});
