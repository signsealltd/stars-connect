import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateDevice } from "@/lib/device-auth";

export async function GET(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) return NextResponse.json({ error: "Tablet not authorised" }, { status: 401 });
  const rows = await prisma.student.findMany({
    where: { active: true },
    select: { id: true, displayName: true, expectedDays: true, profilePhotoUrl: true },
    orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
  });
  return NextResponse.json(rows);
}
