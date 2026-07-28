import { NextRequest, NextResponse } from "next/server";
import type { Role, User } from "@prisma/client";
import { AccessError, requireRole } from "./security";
import { audit } from "./audit";

export function requestContext(req: NextRequest) {
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10);
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").map(value => value.trim()).filter(Boolean) ?? [];
  const ipAddress = Number.isInteger(hops) && hops > 0 && forwarded.length >= hops ? forwarded[forwarded.length - hops] : undefined;
  return { ipAddress, userAgent: req.headers.get("user-agent")?.slice(0, 500) };
}

export function mutationOriginAllowed(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const expected = new URL(process.env.APP_URL ?? req.nextUrl.origin);
    const actual = new URL(origin);
    return actual.protocol === expected.protocol && actual.host === expected.host;
  } catch { return false; }
}

export async function withRole(
  req: NextRequest,
  role: Role,
  handler: (user: User) => Promise<NextResponse>,
) {
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "Request origin was rejected." }, { status: 403 });
  try {
    const user = await requireRole(role);
    return await handler(user);
  } catch (error) {
    await audit("PRIVILEGED_OPERATION_DENIED", {
      actorType: "UNKNOWN",
      ...requestContext(req),
      afterValue: { requiredRole: role, path: req.nextUrl.pathname },
    });
    if (error instanceof AccessError) {
      return NextResponse.json({ error: error.status === 401 ? "Please sign in." : "You do not have permission to do that." }, { status: error.status });
    }
    return NextResponse.json({ error: "Request failed." }, { status: 500 });
  }
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
