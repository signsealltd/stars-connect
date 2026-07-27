import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateDevice } from "@/lib/device-auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) return NextResponse.json({ error: "This tablet is not authorised." }, { status: 401 });
  const limit = rateLimit(`visitor-onsite:${device.id}`, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Please wait before refreshing the visitor list." }, { status: 429 });
  const visits = await prisma.visitorVisit.findMany({
    where: { signedOutAt: null },
    include: { visitor: { select: { fullName: true, company: true } } },
    orderBy: { signedInAt: "desc" },
    take: 100,
  });
  return NextResponse.json(visits.map(visit => ({
    id: visit.id,
    fullName: visit.visitor.fullName,
    company: visit.visitor.company,
    host: visit.host,
    signedInAt: visit.signedInAt,
  })));
}
