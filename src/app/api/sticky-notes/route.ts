import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withCapability, jsonError } from "@/lib/api";
import { CAPABILITIES } from "@/lib/permissions";

const noteSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  colour: z.enum(["yellow", "pink", "blue", "green"]).default("yellow"),
});

// Ownership always comes from the session, including for administrators.
export async function GET(req: NextRequest) {
  return withCapability(req, CAPABILITIES.DASHBOARD_VIEW, async user =>
    NextResponse.json(await prisma.stickyNote.findMany({
      where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }), { headers: { "Cache-Control": "private, no-store" } }));
}

export async function POST(req: NextRequest) {
  return withCapability(req, CAPABILITIES.DASHBOARD_VIEW, async user => {
    const parsed = noteSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Write a note of up to 4,000 characters and choose a colour.", 422);
    return NextResponse.json(await prisma.stickyNote.create({
      data: { ...parsed.data, userId: user.id },
    }), { status: 201 });
  });
}

export async function PATCH(req: NextRequest) {
  return withCapability(req, CAPABILITIES.DASHBOARD_VIEW, async user => {
    const parsed = noteSchema.extend({ id: z.string().uuid(), updatedAt: z.string().datetime() })
      .safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Check the note and try again.", 422);
    const { id, updatedAt, ...data } = parsed.data;
    const changed = await prisma.stickyNote.updateMany({
      where: { id, userId: user.id, updatedAt: new Date(updatedAt) }, data,
    });
    if (!changed.count) return jsonError("This note changed or is no longer available. Reload your notes before editing it again.", 409);
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest) {
  return withCapability(req, CAPABILITIES.DASHBOARD_VIEW, async user => {
    const parsed = z.object({ id: z.string().uuid(), updatedAt: z.string().datetime() })
      .safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Choose a note to remove.", 422);
    const removed = await prisma.stickyNote.deleteMany({ where: {
      id: parsed.data.id, userId: user.id, updatedAt: new Date(parsed.data.updatedAt),
    } });
    if (!removed.count) return jsonError("This note changed or is no longer available. Reload your notes first.", 409);
    return NextResponse.json({ ok: true });
  });
}
