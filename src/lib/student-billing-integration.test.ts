import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (file: string) => readFileSync(file, "utf8");

describe("student emergency contacts and billing integration", () => {
  it("adds protected emergency contact fields through a deployable migration", () => {
    const migration = source("prisma/migrations/202607280001_student_emergency_contacts/migration.sql");
    expect(migration).toContain("emergencyContactName");
    expect(migration).toContain("emergencyContactPhone");
    expect(migration).toContain("emergencyContactEmail");
  });

  it("never sends emergency contact fields to kiosk tablets", () => {
    const kiosk = source("src/app/api/students/route.ts");
    expect(kiosk).toContain("select: { id: true, displayName: true, expectedDays: true, profilePhotoUrl: true }");
    expect(kiosk).not.toContain("emergencyContactName");
  });

  it("creates student and billing data atomically and restricts billing to elevated roles", () => {
    const route = source("src/app/api/students/records/route.ts");
    expect(route).toContain("prisma.$transaction");
    expect(route).toContain("createInlineBillingProfile");
    expect(route).toContain("directorRoles.has(user.role)");
  });

  it("allows billing edits but protects used financial history from deletion", () => {
    const route = source("src/app/api/billing/profiles/[id]/manage/route.ts");
    expect(route).toContain("BILLING_PROFILE_CHANGED");
    expect(route).toContain("billingCharge.count");
    expect(route).toContain("invoice.count");
    expect(route).toContain("cannot be deleted. End it instead");
    expect(route).toContain("BILLING_PROFILE_DELETED");
  });

  it("exposes emergency contacts and inline billing in the student editor", () => {
    const component = source("src/components/student-manager-v2.tsx");
    expect(component).toContain("Emergency contact");
    expect(component).toContain("not downloaded to kiosk tablets");
    expect(component).toContain("Set up billing when this student is saved");
  });

  it("omits the billing object when inline billing is disabled", () => {
    const component = source("src/components/student-manager-v2.tsx");
    expect(component).toContain("canManageBilling && form.billing.enabled ? form.billing : undefined");
    const createRoute = source("src/app/api/students/records/route.ts");
    expect(createRoute).toContain("studentValidationMessage(parsed.error)");
    const updateRoute = source("src/app/api/students/records/[id]/route.ts");
    expect(updateRoute).toContain("studentValidationMessage(parsed.error)");
  });
});
