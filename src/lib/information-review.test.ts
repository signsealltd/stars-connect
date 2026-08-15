import { describe, expect, it } from "vitest";
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
});
