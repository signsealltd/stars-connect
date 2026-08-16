import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  REVIEW_TOKEN_BYTES,
  buildChangeProposals,
  createReviewToken,
  hashReviewToken,
  publicReviewState,
  reviewAnswersSchema,
  reviewDeclarationSchema,
  tokenHashesMatch,
} from "./information-review";

describe("secure annual information reviews", () => {
  it("creates high-entropy tokens and stores only a one-way hash", () => {
    const first = createReviewToken();
    const second = createReviewToken();
    expect(Buffer.from(first.token, "base64url")).toHaveLength(REVIEW_TOKEN_BYTES);
    expect(first.token).not.toBe(first.tokenHash);
    expect(first.tokenHash).toBe(hashReviewToken(first.token));
    expect(first.tokenHash).not.toBe(second.tokenHash);
    expect(tokenHashesMatch(first.token, first.tokenHash)).toBe(true);
    expect(tokenHashesMatch(second.token, first.tokenHash)).toBe(false);
  });

  it("produces field-level proposals without mutating unchanged values", () => {
    const current = { firstName: "Alex", emergencyContactPhone: "020 0000 0000", medicalProfile: { allergies: "None" } };
    const submitted = { ...current, emergencyContactPhone: "020 1111 1111", medicalProfile: { allergies: "Penicillin" } };
    const proposals = buildChangeProposals(current, submitted);
    expect(proposals.map(item => item.fieldKey)).toEqual(["emergencyContactPhone", "medicalProfile"]);
    expect(proposals.every(item => item.critical)).toBe(true);
    expect(current.emergencyContactPhone).toBe("020 0000 0000");
  });

  it("locks terminal, expired, revoked and temporarily locked reviews", () => {
    const future = new Date(Date.now() + 60_000), past = new Date(Date.now() - 60_000);
    expect(publicReviewState({ status: "DRAFT", expiresAt: future })).toBe("OPEN");
    expect(publicReviewState({ status: "SUBMITTED", expiresAt: future })).toBe("SUBMITTED");
    expect(publicReviewState({ status: "DRAFT", expiresAt: past })).toBe("EXPIRED");
    expect(publicReviewState({ status: "DRAFT", expiresAt: future, revokedAt: new Date() })).toBe("REVOKED");
    expect(publicReviewState({ status: "DRAFT", expiresAt: future, lockedUntil: future })).toBe("LOCKED");
  });

  it("requires a valid identity declaration and constrains submitted data", () => {
    expect(reviewDeclarationSchema.safeParse({ declarationName: "A Parent", declarationCapacity: "Parent", accepted: true }).success).toBe(true);
    expect(reviewDeclarationSchema.safeParse({ declarationName: "A", declarationCapacity: "Parent", accepted: true }).success).toBe(false);
    expect(reviewAnswersSchema.safeParse({ firstName: "Alex", lastName: "Smith", displayName: "Alex", email: "not-an-email" }).success).toBe(false);
  });

  it("accepts structured repeatable medical, consent and billing answers", () => {
    const result = reviewAnswersSchema.safeParse({
      firstName: "Alex", lastName: "Smith", displayName: "Alex",
      medicalProfile: {
        conditions: ["Epilepsy"], allergies: ["Penicillin"],
        currentMedication: [{ name: "Medicine A", frequency: "Twice daily", dosage: "5 ml" }],
        emergencyMedication: [{ name: "Rescue medicine", frequency: "When required", dosage: "One dose" }],
      },
      consents: {
        photography: { internalCareRecords: true, website: false, socialMedia: false, printedMaterials: false, newslettersDisplays: true, pressReleases: false, promotionalVideos: false, none: false },
        localTrips: "OTHER", localTripsOther: "Please telephone first", transport: true, emergencyTreatment: true, informationSharing: false,
      },
      billing: { payerType: "LOCAL_AUTHORITY", payerName: "Example Council", email: "billing@example.test" },
    });
    expect(result.success).toBe(true);
  });

  it("continues accepting older free-text medical and boolean consent answers", () => {
    const result = reviewAnswersSchema.safeParse({
      firstName: "Alex", lastName: "Smith", displayName: "Alex",
      medicalProfile: { conditions: "None known", allergies: "None known", currentMedication: "Medicine A" },
      consents: { photography: true, localTrips: false, transport: true },
    });
    expect(result.success).toBe(true);
  });

  it("provides a safe preview and password-protected review cancellation or deletion", () => {
    const form = readFileSync("src/components/public-information-review.tsx", "utf8");
    const manager = readFileSync("src/components/information-review-manager.tsx", "utf8");
    const route = readFileSync("src/app/api/information-reviews/[id]/route.ts", "utf8");
    expect(form).toContain("Welcome to your STARS information review");
    expect(form).toContain("Preview only");
    expect(form).toContain("Add another medication");
    expect(form).toContain("Local authority or council");
    expect(form).toContain("Health professionals and agencies");
    expect(manager).toContain("/dashboard/information-reviews/preview");
    expect(manager).toContain("Cancel request");
    expect(manager).toContain("immediately makes its secure public link unusable");
    const approval = readFileSync("src/components/information-review-approval.tsx", "utf8");
    expect(approval).toContain("Who pays?");
    expect(approval).toContain("Photographs and media");
    expect(approval).toContain("Information sharing with health professionals");
    expect(approval).not.toContain("JSON.stringify(value,null,2)");
    expect(route).toContain("bcrypt.compare");
    expect(route).toContain("INFORMATION_REVIEW_DELETED");
    expect(route).toContain("INFORMATION_REVIEW_CANCELLED");
  });
});
