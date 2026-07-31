import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCapability, jsonError } from "@/lib/api";
import { CAPABILITIES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireOrganisation } from "@/lib/compliance-service";
import { reconcileExpectedDay } from "@/lib/operations-service";

export async function GET(req: NextRequest) {
  return withCapability(req, CAPABILITIES.ATTENDANCE_RECONCILIATION_VIEW, async user => {
    const organisationId = requireOrganisation(user);
    const state = req.nextUrl.searchParams.get("state");
    const records = await prisma.attendanceReconciliation.findMany({
      where: { organisationId, ...(state ? { state: state as never } : {}) },
      include: { expectedAttendance: { include: { staff: { select: { id: true, displayName: true } }, scheduleOccurrence: { select: { startAt: true, endAt: true, premisesName: true } } } } },
      orderBy: { calculatedAt: "desc" }, take: 250,
    });
    return NextResponse.json({ records });
  });
}
export async function POST(req:NextRequest){
 return withCapability(req,CAPABILITIES.ATTENDANCE_RECONCILIATION_MANAGE,async user=>{
  const parsed=z.object({date:z.iso.date()}).safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return jsonError("Please provide a valid date.",422);
  return NextResponse.json(await reconcileExpectedDay(user,parsed.data.date));
 });
}
