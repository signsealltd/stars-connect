import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, type AttendanceStatus, type ClockEventType, type PhotoStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { applyVisitorSignIn, applyVisitorSignOut, publicVisitorPayload } from "@/lib/visitor-service";
import { localDateAsDatabaseDate, localDateKey } from "@/lib/dates";

const eventSchema = z.object({
  id: z.uuid(),
  operation: z.enum(["CLOCK_EVENT", "ATTENDANCE", "ROLL_CALL_ENTRY", "VISITOR_SIGN_IN", "VISITOR_SIGN_OUT"]),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  attempts: z.number(),
});
const bodySchema = z.object({ cursor: z.string().regex(/^\d+$/), events: z.array(eventSchema).max(250) });

async function authorise(req: NextRequest) {
  const id = req.headers.get("x-device-id");
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!id || !token) return null;
  if (id === "development-device" && token === "development-token" && process.env.NODE_ENV !== "production") {
    const first = await prisma.device.findFirst({ where: { isSeedData: true } });
    return first;
  }
  return prisma.device.findFirst({ where: { id, tokenHash: sha256(token), status: "ACTIVE" } });
}

export async function POST(req: NextRequest) {
  const device = await authorise(req);
  if (!device) return NextResponse.json({ error: "This tablet is not authorised. Ask an administrator to check Devices." }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The synchronisation data was not valid." }, { status: 400 });
  const visitorEvents = parsed.data.events.filter((event) => event.operation.startsWith("VISITOR_"));
  if (visitorEvents.length) { const limit = rateLimit(`visitor-submit:${device.id}`, 20, 60_000); if (!limit.allowed) return NextResponse.json({ error: "Too many visitor submissions. Please wait and retry." }, { status: 429 }); }
  const acknowledged: string[] = [];

  for (const item of parsed.data.events) {
    if (await prisma.syncEvent.findUnique({ where: { eventId: item.id } })) {
      acknowledged.push(item.id);
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        const p = item.payload;
        if (item.operation === "CLOCK_EVENT") {
          const timestamp = new Date(String(p.deviceTimestamp));
          const duplicate = await tx.clockEvent.findFirst({
            where: {
              staffId: String(p.staffId), type: String(p.type) as ClockEventType,
              deviceTimestamp: { gte: new Date(timestamp.getTime() - 20_000), lte: new Date(timestamp.getTime() + 20_000) },
            },
          });
          if (duplicate) {
            await tx.syncConflict.create({
              data: {
                entityType: "ClockEvent", entityId: item.id, deviceId: device.id,
                serverValue: JSON.parse(JSON.stringify(duplicate)), incomingValue: p as Prisma.InputJsonValue,
              },
            });
          } else {
            await tx.clockEvent.create({
              data: {
                id: item.id, staffId: String(p.staffId), deviceId: device.id,
                type: String(p.type) as ClockEventType, deviceTimestamp: timestamp,
                offlineRecorded: Boolean(p.offlineRecorded),
                photoStatus: String(p.photoStatus || "NOT_REQUIRED") as PhotoStatus,
              },
            });
          }
        } else if (item.operation === "ATTENDANCE") {
          const date = new Date(`${String(p.date).slice(0, 10)}T00:00:00.000Z`);
          const current = await tx.studentAttendance.findUnique({ where: { studentId_date: { studentId: String(p.studentId), date } } });
          if (current && Number(p.version) <= current.version && current.deviceTimestamp > new Date(String(p.deviceTimestamp))) {
            await tx.syncConflict.create({
              data: {
                entityType: "StudentAttendance", entityId: item.id, deviceId: device.id,
                serverValue: JSON.parse(JSON.stringify(current)), incomingValue: p as Prisma.InputJsonValue,
              },
            });
          } else {
            await tx.studentAttendance.upsert({
              where: { studentId_date: { studentId: String(p.studentId), date } },
              create: {
                id: item.id, studentId: String(p.studentId), deviceId: device.id, date,
                status: String(p.status) as AttendanceStatus,
                arrivalTime: p.arrivalTime ? new Date(String(p.arrivalTime)) : null,
                departureTime: p.departureTime ? new Date(String(p.departureTime)) : null,
                note: p.note ? String(p.note) : null, deviceTimestamp: new Date(String(p.deviceTimestamp)),
                version: Number(p.version),
              },
              update: {
                deviceId: device.id, status: String(p.status) as AttendanceStatus,
                arrivalTime: p.arrivalTime ? new Date(String(p.arrivalTime)) : null,
                departureTime: p.departureTime ? new Date(String(p.departureTime)) : null,
                note: p.note ? String(p.note) : null, deviceTimestamp: new Date(String(p.deviceTimestamp)),
                version: Number(p.version),
              },
            });
          }
        } else if (item.operation === "VISITOR_SIGN_IN") {
          await applyVisitorSignIn(tx, p, device.id);
        } else if (item.operation === "VISITOR_SIGN_OUT") {
          await applyVisitorSignOut(tx, p, device.id);
        } else if (item.operation === "ROLL_CALL_ENTRY") {
          const rollCallId = String(p.rollCallId);
          const eventTime = new Date(String(p.deviceTimestamp));
          await tx.emergencyRollCall.upsert({ where: { id: rollCallId }, update: {}, create: { id: rollCallId, startedByDeviceId: device.id, attendanceSnapshotAt: eventTime, startedAt: eventTime } });
          await tx.emergencyRollCallEntry.upsert({
              where: { rollCallId_personType_personId: { rollCallId, personType: String(p.personType), personId: String(p.personId) } },
              create: {
                id: String(p.id || item.id), rollCallId, personType: String(p.personType),
                personId: String(p.personId), displayName: String(p.displayName),
                accountedFor: Boolean(p.accountedFor),
                accountedAt: p.accountedFor ? new Date(String(p.deviceTimestamp)) : null,
                deviceTimestamp: new Date(String(p.deviceTimestamp)),
              },
              update: {
                displayName: String(p.displayName), accountedFor: Boolean(p.accountedFor),
                accountedAt: p.accountedFor ? new Date(String(p.deviceTimestamp)) : null,
                deviceTimestamp: new Date(String(p.deviceTimestamp)),
              },
          });
        }
        await tx.syncEvent.create({
          data: { eventId: item.id, deviceId: device.id, operation: item.operation, payload: item.operation.startsWith("VISITOR_") ? publicVisitorPayload(p) : p as Prisma.InputJsonValue },
        });
      });
      acknowledged.push(item.id);
      await audit("SYNC_EVENT_ACCEPTED", { actorType: "DEVICE", deviceId: device.id, entityType: item.operation, entityId: item.id });
      const sourceTimestamp=item.operation==="ATTENDANCE"?String(item.payload.date):item.operation==="CLOCK_EVENT"?String(item.payload.deviceTimestamp):item.operation.startsWith("VISITOR_")?String(item.payload.signedInAt||item.payload.signedOutAt||item.createdAt):null;
      if(sourceTimestamp){const affectedDate=localDateAsDatabaseDate(/^\d{4}-\d{2}-\d{2}$/.test(sourceTimestamp)?sourceTimestamp:localDateKey(new Date(sourceTimestamp)));await prisma.dailyAttendanceReport.updateMany({where:{reportDate:affectedDate,status:{in:["GENERATED","EMAILED","SUPERSEDED"]}},data:{potentiallyOutdated:true}});}
      if (item.operation === "VISITOR_SIGN_IN" || item.operation === "VISITOR_SIGN_OUT") await audit(item.operation === "VISITOR_SIGN_IN" ? "VISITOR_SIGNED_IN" : "VISITOR_SIGNED_OUT", { actorType:"DEVICE",deviceId:device.id,entityType:"VisitorVisit",entityId:String((item.payload as Record<string,unknown>).visitId || item.id) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SYNC_FAILED";
      if (item.operation.startsWith("VISITOR_") && ["INVALID_VISITOR_SIGN_IN","RULE_VERSION_MISMATCH","VISITOR_REASON_MISMATCH","DUPLICATE_ACTIVE_VISITOR","INVALID_VISITOR_SIGN_OUT","VISITOR_NOT_FOUND","INVALID_DEPARTURE_TIME"].includes(message)) {
        await prisma.syncConflict.create({ data: { entityType:"VisitorVisit",entityId:String((item.payload as Record<string,unknown>).visitId || item.id),deviceId:device.id,serverValue:{error:message},incomingValue:publicVisitorPayload(item.payload) } });
        acknowledged.push(item.id);
        await audit("VISITOR_SYNC_CONFLICT",{actorType:"DEVICE",deviceId:device.id,entityType:"VisitorVisit",entityId:item.id,afterValue:{reason:message}});
      } else console.error("Sync event failed", item.id, error);
    }
  }

  const after = BigInt(parsed.data.cursor);
  const updates = await prisma.syncEvent.findMany({ where: { sequence: { gt: after } }, orderBy: { sequence: "asc" }, take: 500 });
  const cursor = updates.at(-1)?.sequence ?? after;
  await prisma.device.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date(), lastSyncAt: new Date(), pendingEventCount: Math.max(0, parsed.data.events.length - acknowledged.length), currentCursor: cursor, appVersion: req.headers.get("x-app-version")?.slice(0,40) || device.appVersion },
  });
  return NextResponse.json({
    acknowledged,
    cursor: String(cursor),
    events: updates.map((event) => ({ ...event, sequence: String(event.sequence) })),
  });
}
