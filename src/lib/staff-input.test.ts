import { describe, expect, it } from "vitest";
import { staffUpdateSchema } from "./staff-input";

const validUpdate = {
  firstName: "Finley",
  lastName: "Ward",
  displayName: "Finley Ward",
  email: "finley.ward@example.test",
  phone: "",
  jobRole: "Support Worker",
  startDate: "2024-01-08",
  endDate: "",
  notes: "",
  clockingEnabled: true,
  pin: "4826",
};

describe("staff update input", () => {
  it("accepts the blank optional dates sent by the edit form", () => {
    expect(staffUpdateSchema.safeParse(validUpdate).success).toBe(true);
  });

  it("still rejects malformed reset PINs", () => {
    expect(staffUpdateSchema.safeParse({ ...validUpdate, pin: "12ab" }).success).toBe(false);
  });
});
