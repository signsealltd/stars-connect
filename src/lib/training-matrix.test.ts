import { describe, expect, it } from "vitest";
import { normaliseTrainingRole, starsTrainingFramework, trainingRoles, trainingState } from "./training-matrix";

describe("STARS training matrix", () => {
  it("contains the supplied role structure and framework", () => {
    expect(trainingRoles).toEqual(["Director", "Manager", "Assistant Manager", "Team Leader", "Support Worker", "Driver", "Volunteer"]);
    expect(starsTrainingFramework.length).toBeGreaterThan(30);
    const driving = starsTrainingFramework.find(course => course.name === "Driving for Work");
    expect(driving?.requirementRules.Driver).toBe("REQUIRED");
    expect(driving?.requirementRules["Support Worker"]).toBe("CONDITIONAL");
  });

  it("normalises familiar job titles without changing stored staff data", () => {
    expect(normaliseTrainingRole("Senior Support Worker")).toBe("Support Worker");
    expect(normaliseTrainingRole("Assistant Manager")).toBe("Assistant Manager");
    expect(normaliseTrainingRole("Unknown role")).toBe("Support Worker");
  });

  it("classifies missing, current, due and expired records", () => {
    const now = new Date("2026-08-28T12:00:00Z");
    expect(trainingState({ requirement:"REQUIRED" }, now)).toBe("MISSING");
    expect(trainingState({ requirement:"CONDITIONAL" }, now)).toBe("CONDITIONAL");
    expect(trainingState({ requirement:"NOT_REQUIRED" }, now)).toBe("NOT_REQUIRED");
    expect(trainingState({ requirement:"REQUIRED", completedDate:"2026-01-01", expiryDate:"2027-01-01" }, now, 60)).toBe("CURRENT");
    expect(trainingState({ requirement:"REQUIRED", completedDate:"2026-01-01", expiryDate:"2026-09-20" }, now, 60)).toBe("DUE_SOON");
    expect(trainingState({ requirement:"REQUIRED", completedDate:"2026-01-01", expiryDate:"2026-08-01" }, now, 60)).toBe("EXPIRED");
  });
});
