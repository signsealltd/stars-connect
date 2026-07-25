import { NextRequest, NextResponse } from "next/server";
import type { Role, User } from "@prisma/client";
import { requireRole } from "./security";
import { audit } from "./audit";

export function requestContext(req: NextRequest) {
  return {
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: req.headers.get("user-agent")?.slice(0, 500),
  };
}

export async function withRole(
  req: NextRequest,
  role: Role,
  handler: (user: User) => Promise<NextResponse>,
) {
  try {
    const user = await requireRole(role);
    return await handler(user);
  } catch (error) {
    await audit("PRIVILEGED_OPERATION_DENIED", {
      actorType: "UNKNOWN",
      ...requestContext(req),
      afterValue: { requiredRole: role, path: req.nextUrl.pathname },
    });
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHORISED" ? "You do not have permission to do that." : "Request failed." },
      { status: error instanceof Error && error.message === "UNAUTHORISED" ? 403 : 500 },
    );
  }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
