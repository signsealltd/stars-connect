import { z } from "zod";
export const trainingSchema = z.object({
  staffId: z.string().uuid(), courseName: z.string().trim().min(2).max(191),
  provider: z.string().trim().max(191).nullable().optional(), certificateReference: z.string().trim().max(191).nullable().optional(),
  completedDate: z.string().date(), expiryDate: z.string().date().nullable().optional().or(z.literal("")),
  mandatory: z.boolean().default(false), notes: z.string().trim().max(5000).nullable().optional(),
});