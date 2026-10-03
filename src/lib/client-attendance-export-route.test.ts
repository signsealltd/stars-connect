import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), permission: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { student: { findMany: mocks.findMany } } }));
vi.mock("@/lib/permissions", () => ({ CAPABILITIES: { STUDENTS_VIEW: "module.students.view" }, requireCapability: mocks.permission }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/organisation-settings", () => ({ getOrganisationSettings: async () => ({ organisationName: "STARS" }) }));
vi.mock("@/lib/security", () => ({ AccessError: class extends Error { constructor(public status: number) { super("Denied"); } }, requireRole: vi.fn() }));
import { GET } from "@/app/api/students/records/export/route";
import { AccessError } from "@/lib/security";
describe("client attendance download", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.permission.mockResolvedValue({ id: "reviewer" }); mocks.findMany.mockResolvedValue([]); });
  it("exports all active non-archived clients, ignoring list filters, with private headers and audit", async () => {
    const response = await GET(new NextRequest("http://localhost/api/students/records/export?search=Adam&status=archived"));
    expect(response.status).toBe(200);
    expect(mocks.permission).toHaveBeenCalledWith("module.students.view");
    expect(mocks.findMany).toHaveBeenCalledWith({ where: { active: true, archivedAt: null }, select: { id: true, firstName: true, lastName: true, displayName: true, internalReference: true } });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(mocks.audit).toHaveBeenCalledWith("ACTIVE_CLIENT_ATTENDANCE_EXPORTED", expect.objectContaining({ actorId: "reviewer" }));
  });
  it.each([401,403] as const)("rejects unauthorised access (%s) before fetching clients", async status => {
    mocks.permission.mockRejectedValue(new AccessError(status,"FORBIDDEN"));
    const response = await GET(new NextRequest("http://localhost/api/students/records/export"));
    expect(response.status).toBe(status);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
