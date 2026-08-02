import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createUserSchema, updateUserSchema } from "./user-input";

const source=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
describe("administrator user management",()=>{
  it("enforces strong passwords and valid roles",()=>{
    expect(createUserSchema.safeParse({name:"Test Manager",username:"test.manager",email:"manager@example.org",role:"MANAGER",password:"StrongPassword1"}).success).toBe(true);
    expect(createUserSchema.safeParse({name:"Test Manager",username:"test.manager",email:"manager@example.org",role:"OWNER",password:"weak"}).success).toBe(false);
    expect(updateUserSchema.safeParse({password:"AnotherStrong2"}).success).toBe(true);
  });
  it("protects self access, the final administrator and invalidates sessions",()=>{
    const route=source("src/app/api/users/[id]/route.ts");
    expect(route).toContain("You cannot remove your own administrator access");
    expect(route).toContain("You cannot delete your own account");
    expect(route).toContain("At least one active administrator must remain");
    expect(route).toContain("session.deleteMany");
    expect(route).toContain('action: "USER_DELETED"');
  });
});
describe("secure SMTP administration",()=>{
  it("encrypts stored passwords and never returns them from the configuration API",()=>{
    const settings=source("src/lib/smtp-settings.ts"),route=source("src/app/api/email/config/route.ts");
    expect(settings).toContain("aes-256-gcm");
    expect(settings).toContain("SETTINGS_ENCRYPTION_KEY_REQUIRED");
    expect(route).not.toContain("SMTP_PASSWORD:");
    expect(route).not.toContain("passwordCipher:");
  });
});
describe("live-test cleanup",()=>{
  it("requires explicit confirmation and removes dependent data before people and devices",()=>{
    const cleanup=source("scripts/prepare-live-test.ts");
    expect(cleanup).toContain("CONFIRM_LIVE_TEST_RESET");
    expect(cleanup.indexOf("clockEvent.deleteMany")).toBeLessThan(cleanup.indexOf("staffMember.deleteMany"));
    expect(cleanup.indexOf("studentAttendance.deleteMany")).toBeLessThan(cleanup.indexOf("student.deleteMany"));
    expect(cleanup.indexOf("syncEvent.deleteMany")).toBeLessThan(cleanup.indexOf("device.deleteMany"));
  });
  it("clears stale kiosk IndexedDB when a tablet is newly provisioned",()=>{
    expect(source("src/app/setup/page.tsx")).toContain("resetKioskDataForProvisioning");
  });
});
