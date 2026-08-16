import { z } from "zod";

export const ramsHazardSuggestion = z.object({
  hazard: z.string().trim().min(3).max(240),
  whoMayBeHarmed: z.string().trim().min(3).max(240),
  howTheyMayBeHarmed: z.string().trim().min(3).max(500),
  existingControls: z.string().trim().min(3).max(1200),
  furtherControls: z.string().trim().max(1200).default(""),
  initialLikelihood: z.number().int().min(1).max(5),
  initialSeverity: z.number().int().min(1).max(5),
  residualLikelihood: z.number().int().min(1).max(5),
  residualSeverity: z.number().int().min(1).max(5),
});

export const ramsMethodStepSuggestion = z.object({
  stage: z.string().trim().min(2).max(160),
  method: z.string().trim().min(3).max(1200),
  responsibleRole: z.string().trim().max(160).default(""),
  safetyChecks: z.string().trim().max(800).default(""),
  stopWorkConditions: z.string().trim().max(800).default(""),
});

export const ramsSuggestionRequest = z.object({
  kind: z.enum(["hazards", "safeMethod"]),
  title: z.string().trim().min(2).max(180),
  activityDescription: z.string().trim().min(8).max(2000),
  location: z.string().trim().max(300).default(""),
});

export const ramsSuggestionResponse = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hazards"), hazards: z.array(ramsHazardSuggestion).min(1).max(8) }),
  z.object({
    kind: z.literal("safeMethod"),
    methodStatement: z.string().trim().min(8).max(2400),
    methodSteps: z.array(ramsMethodStepSuggestion).min(1).max(10),
  }),
]);

export type RamsSuggestion = z.infer<typeof ramsSuggestionResponse>;

export function extractRamsSuggestion(value: string): RamsSuggestion | null {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = ramsSuggestionResponse.safeParse(JSON.parse(cleaned));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

