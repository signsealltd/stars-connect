import { describe, expect, it } from "vitest";
import { latestConsentValues, medicalProfileSchema, secondaryEmergencyContactSchema } from "./student-profile";

describe("extended client profiles", () => {
  it("validates structured emergency and medical information", () => {
    expect(secondaryEmergencyContactSchema.parse({ name: "Pat", relationship: "Parent", phone: "020 0000 0000", email: "" })).toMatchObject({ name: "Pat" });
    expect(medicalProfileSchema.parse({ allergies: "Penicillin", conditions: "None known" })).toMatchObject({ allergies: "Penicillin" });
  });

  it("uses the newest consent decision for each consent type", () => {
    expect(latestConsentValues([
      { consentType: "photography", newValue: false },
      { consentType: "photography", newValue: true },
      { consentType: "transport", newValue: true },
    ])).toEqual({ photography: false, transport: true });
  });
});
