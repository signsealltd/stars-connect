import { z } from "zod";
import { CAPABILITIES } from "./permissions";

export const roles = ["ADMINISTRATOR", "DIRECTOR", "MANAGER", "RECEPTION"] as const;
const capabilityKeys=Object.values(CAPABILITIES) as [string,...string[]];
const permissionOverrides=z.record(z.enum(capabilityKeys),z.boolean()).optional();

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(191).transform((value) => value.toLowerCase()),
  role: z.enum(roles),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, "Password needs a lowercase letter.")
    .regex(/[A-Z]/, "Password needs an uppercase letter.")
    .regex(/\d/, "Password needs a number."),
  permissionOverrides,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.email().max(191).transform((value) => value.toLowerCase()).optional(),
  role: z.enum(roles).optional(),
  active: z.boolean().optional(),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/)
    .optional(),
  permissionOverrides,
});
