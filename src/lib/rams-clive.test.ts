import { describe, expect, it } from "vitest";
import { extractRamsSuggestion, ramsSuggestionRequest } from "./rams-clive";

describe("Clive RAMS structured suggestions", () => {
  it("requires a meaningful activity before requesting suggestions", () => {
    expect(ramsSuggestionRequest.safeParse({ kind: "hazards", title: "Trip", activityDescription: "short", location: "" }).success).toBe(false);
  });

  it("parses validated hazard suggestions and rejects unsafe shapes", () => {
    const valid = JSON.stringify({ kind: "hazards", hazards: [{ hazard: "Road crossing", whoMayBeHarmed: "Participants and staff", howTheyMayBeHarmed: "Collision with a vehicle", existingControls: "Use planned crossings and staff supervision", furtherControls: "Brief everyone before departure", initialLikelihood: 3, initialSeverity: 5, residualLikelihood: 1, residualSeverity: 5 }] });
    expect(extractRamsSuggestion(valid)?.kind).toBe("hazards");
    expect(extractRamsSuggestion('{"kind":"hazards","hazards":[]}')).toBeNull();
  });

  it("accepts fenced safe-method JSON", () => {
    const value = '```json\n{"kind":"safeMethod","methodStatement":"Complete the activity in controlled stages.","methodSteps":[{"stage":"Preparation","method":"Brief staff and check arrangements","responsibleRole":"Activity lead","safetyChecks":"Confirm attendance","stopWorkConditions":"Staffing is insufficient"}]}\n```';
    expect(extractRamsSuggestion(value)?.kind).toBe("safeMethod");
  });
});

