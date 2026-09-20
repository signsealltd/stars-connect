import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const route = readFileSync(join(root, "src/app/api/calendar/pilot/route.ts"), "utf8");
const service = readFileSync(join(root, "src/lib/operations-service.ts"), "utf8");
const client = readFileSync(join(root, "src/components/calendar-pilot.tsx"), "utf8");

describe("calendar activity client planning", () => {
  it("validates a bounded unique client selection and enforces attendee permission", () => {
    expect(route).toContain("studentIds: z.array(z.string().uuid()).max(250)");
    expect(route).toContain("CAPABILITIES.OPERATIONS_ASSIGN_ATTENDEES");
    expect(route).toContain("attendeeStudentIds: input.studentIds");
  });

  it("persists planned attendees atomically with the operation", () => {
    expect(service).toContain("tx.operationAttendee.createMany");
    expect(service).toContain('status:"PLANNED"');
    expect(service).toContain("attendeeCount:attendeeStudentIds.length");
  });

  it("provides searchable selection while preserving planning-only wording", () => {
    expect(client).toContain("Search by client name or reference");
    expect(client).toContain("does not mark attendance");
    expect(client).toContain("linked to RAMS");
  });
});
