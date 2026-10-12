import { z } from "zod";
export const trainingSchema = z.object({
  evidenceDetails:z.object({assessor:z.string().max(191).optional(),outcome:z.enum(["","PASSED","FAILED","ATTENDED"]).optional(),scope:z.string().max(2000).optional(),clientId:z.string().max(191).optional(),planId:z.string().max(191).optional(),planVersion:z.string().max(100).optional(),standards:z.string().max(3000).optional(),verifiedPriorAchievement:z.boolean().optional(),verificationReason:z.string().max(1000).optional(),qualification:z.enum(["","EFAW","FAW"]).optional(),formalTrainingDate:z.string().date().optional().or(z.literal("")),formalRefresherMonths:z.number().int().min(1).max(120).optional(),refresherDate:z.string().date().optional().or(z.literal(""))}).optional(),
  staffId: z.string().uuid(), courseName: z.string().trim().min(2).max(191),
  courseId: z.string().uuid().nullable().optional(), providerId: z.string().uuid().nullable().optional(),
  provider: z.string().trim().max(191).nullable().optional(), certificateReference: z.string().trim().max(191).nullable().optional(),
  completedDate: z.string().date(), expiryDate: z.string().date().nullable().optional().or(z.literal("")),
  mandatory: z.boolean().default(false), notes: z.string().trim().max(5000).nullable().optional(),
  fullTier2Verified: z.boolean().optional(),
});
