import { z } from "zod";

export const roles = ["ADMINISTRATOR", "DIRECTOR", "MANAGER", "RECEPTION"] as const;

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(191).transform((value) => value.toLowerCase()),
  role: z.enum(roles),
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, "Password needs a lowercase letter.")
    .regex(/[A-Z]/, "Password needs an uppercase letter.")
    .regex(/\d/, "Password needs a number."),
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
});
