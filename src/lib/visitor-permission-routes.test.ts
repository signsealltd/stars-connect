import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const state = vi.hoisted(() => ({
  user: {
    id: "user-1",
    name: "Test manager",
    email: "manager@example.test",
    passwordHash: "unused",
    role: "MANAGER" as "MANAGER" | "RECEPTION",
    active: true,
    permissionOverrides: null as Record<string, boolean> | null,
    themeMode: "SYSTEM",
    quickActions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  visit: {
    id: "visit-1",
    signedInAt: new Date("2026-07-29T09:00:00Z"),
    signedOutAt: null,
    visitor: {
      id: "visitor-1",
      fullName: "Synthetic Visitor",
      mobile: "07000000000",
      email: "visitor@example.test",
    },
    reason: null,
    acceptance: null,
    signInDevice: null,
    signOutDevice: null,
    signedOutByUser: null,
  },
}));

vi.mock("@/lib/api", () => ({
  withRole: async (_request: NextRequest, _role: string, handler: (user: typeof state.user) => Promise<NextResponse>) => handler(state.user),
  jsonError: (error: string, status = 400) => NextResponse.json({ error }, { status }),
  requestContext: () => ({}),
}));

vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    visitorSignature: {
      findUnique: vi.fn(async () => ({
        strokeData: [{ x: 1, y: 1 }],
        pointCount: 1,
        createdAt: new Date("2026-07-29T09:00:00Z"),
        deletedAt: null,
      })),
    },
    visitorVisit: { findUnique: vi.fn(async () => structuredClone(state.visit)) },
    auditLog: { findMany: vi.fn(async () => []) },
  },
}));

import { GET as getSignature } from "@/app/api/visitors/[id]/signature/route";
import { GET as getVisitor } from "@/app/api/visitors/[id]/route";
import { CAPABILITIES, hasCapability } from "./permissions";

const request = new NextRequest("https://app.starsconnect.co.uk/api/visitors/visit-1");
const params = { params: Promise.resolve({ id: "visit-1" }) };

beforeEach(() => {
  state.user.role = "MANAGER";
  state.user.permissionOverrides = null;
});

describe("visitor signature and contact authorization", () => {
  it("allows a manager to view signatures by default through the API", async () => {
    expect(hasCapability("MANAGER", CAPABILITIES.VISITOR_SIGNATURE_VIEW)).toBe(true);
    expect((await getSignature(request, params)).status).toBe(200);
  });

  it("redacts contact fields when a manager explicitly lacks contact access", async () => {
    state.user.permissionOverrides = { [CAPABILITIES.VISITOR_CONTACT_VIEW]: false };
    const response = await getVisitor(request, params);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.visitor.mobile).toBeNull();
    expect(body.visitor.email).toBeNull();
  });

  it("returns 403 when reception directly requests a signature without permission", async () => {
    state.user.role = "RECEPTION";
    expect((await getSignature(request, params)).status).toBe(403);
  });

  it("honours explicit reception allow and manager deny overrides", async () => {
    state.user.role = "RECEPTION";
    state.user.permissionOverrides = { [CAPABILITIES.VISITOR_SIGNATURE_VIEW]: true };
    expect((await getSignature(request, params)).status).toBe(200);

    state.user.role = "MANAGER";
    state.user.permissionOverrides = { [CAPABILITIES.VISITOR_SIGNATURE_VIEW]: false };
    expect((await getSignature(request, params)).status).toBe(403);
  });

  it("keeps contact and signature permissions independent", () => {
    expect(hasCapability("RECEPTION", CAPABILITIES.VISITOR_CONTACT_VIEW, {
      [CAPABILITIES.VISITOR_SIGNATURE_VIEW]: true,
    })).toBe(false);
  });
});
