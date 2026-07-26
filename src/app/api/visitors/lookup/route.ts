import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateDevice } from "@/lib/device-auth";
import { normalizeVisitorName } from "@/lib/visitors";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ fullName: z.string().trim().min(2).max(120), referenceCode: z.string().trim().regex(/^[A-Za-z0-9]{6,12}$/) });
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) return NextResponse.json({ error: "This tablet is not authorised." }, { status: 401 });
  const limit = rateLimit(`visitor-lookup:${device.id}`, 12, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your full name and visit reference." }, { status: 422 });
  const visit = await prisma.visitorVisit.findFirst({ where: { referenceCode: parsed.data.referenceCode.toUpperCase(), signedOutAt: null, visitor: { normalizedName: normalizeVisitorName(parsed.data.fullName) } } });
  if (!visit) return NextResponse.json({ error: "No active visit matched those details." }, { status: 404 });
  return NextResponse.json({ id: visit.id, signedInAt: visit.signedInAt });
}