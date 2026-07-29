import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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
const attendanceStatusSchema = z.enum(["NOT_MARKED", "PRESENT", "ABSENT", "OFFSITE", "LATE", "CANCELLED"]);
const attendancePhotoRoot = process.env.ATTENDANCE_PHOTO_STORAGE_PATH || path.join(process.cwd(), ".data", "attendance-photos");
const batteryHeadersSchema = z.object({
  level: z.coerce.number().int().min(0).max(100),
  charging: z.enum(["true", "false"]).transform(value => value === "true"),
  updatedAt: z.iso.datetime(),
});

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
  const suppliedId=req.headers.get("x-device-id"),suppliedToken=req.headers.get("authorization")?.replace(/^Bearer /, "");
  if(!suppliedId||!suppliedToken)return NextResponse.json({error:"This browser has not been provisioned as a kiosk device.",category:"DEVICE_UNPROVISIONED"},{status:401});
  const device = await authorise(req);
  if (!device) return NextResponse.json({ error: "This tablet credential is not authorised. Ask an administrator to check Devices.",category:"DEVICE_CREDENTIAL_REJECTED" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The synchronisation data was not valid.",category:"PAYLOAD_INVALID" }, { status: 400 });
  const visitorEvents = parsed.data.events.filter((event) => event.operation.startsWith("VISITOR_"));
  if (visitorEvents.length) { const limit = rateLimit(`visitor-submit:${device.id}`, 20, 60_000); if (!limit.allowed) return NextResponse.json({ error: "Too many visitor submissions. Please wait and retry.",category:"RATE_LIMITED" }, { status: 429 }); }
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
                serverValue: JSON.parse(JSON.stringify(duplicate)), incomingValue: Object.fromEntries(Object.entries(p).filter(([key]) => key !== "photoDataUrl")) as Prisma.InputJsonValue,
              },
            });
          } else {
            const photoDataUrl = typeof p.photoDataUrl === "string" ? p.photoDataUrl : "";
            let photoBuffer: Buffer | undefined;
            if (p.photoStatus === "CAPTURED") {
              const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(photoDataUrl);
              if (!match) throw new Error("INVALID_ATTENDANCE_PHOTO");
              photoBuffer = Buffer.from(match[1], "base64");
              if (!photoBuffer.length || photoBuffer.length > 250_000) throw new Error("INVALID_ATTENDANCE_PHOTO");
            }
            await tx.clockEvent.create({
              data: {
                id: item.id, staffId: String(p.staffId), deviceId: device.id,
                type: String(p.type) as ClockEventType, deviceTimestamp: timestamp,
                offlineRecorded: Boolean(p.offlineRecorded),
                photoStatus: String(p.photoStatus || "NOT_REQUIRED") as PhotoStatus,
              },
            });
            if (photoBuffer) {
              const retention = await tx.appSetting.findUnique({ where: { key: "photoRetentionDays" } });
              const retentionDays = Math.min(3650, Math.max(1, Number(retention?.value || 30)));
              await mkdir(attendancePhotoRoot, { recursive: true });
              const storagePath = path.join(attendancePhotoRoot, `${item.id}.jpg`);
              await writeFile(storagePath, photoBuffer);
              await tx.attendancePhoto.create({ data: { clockEventId: item.id, storagePath, mimeType: "image/jpeg", sizeBytes: photoBuffer.length, expiresAt: new Date(Date.now() + retentionDays * 86_400_000) } });
            }
          }
        } else if (item.operation === "ATTENDANCE") {
          const date = new Date(`${String(p.date).slice(0, 10)}T00:00:00.000Z`);
          const status = attendanceStatusSchema.parse(p.status);
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
                status: status as AttendanceStatus,
                arrivalTime: p.arrivalTime ? new Date(String(p.arrivalTime)) : null,
                departureTime: p.departureTime ? new Date(String(p.departureTime)) : null,
                note: p.note ? String(p.note) : null, deviceTimestamp: new Date(String(p.deviceTimestamp)),
                version: Number(p.version),
              },
              update: {
                deviceId: device.id, status: status as AttendanceStatus,
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
        const replicatedPayload = item.operation.startsWith("VISITOR_") ? publicVisitorPayload(p) : item.operation === "CLOCK_EVENT" ? Object.fromEntries(Object.entries(p).filter(([key]) => key !== "photoDataUrl")) : p;
        await tx.syncEvent.create({
          data: { eventId: item.id, deviceId: device.id, operation: item.operation, payload: replicatedPayload as Prisma.InputJsonValue },
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
  const battery = batteryHeadersSchema.safeParse({
    level: req.headers.get("x-battery-level"),
    charging: req.headers.get("x-battery-charging"),
    updatedAt: req.headers.get("x-battery-updated-at"),
  });
  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(), lastSyncAt: new Date(),
      pendingEventCount: Math.max(0, parsed.data.events.length - acknowledged.length),
      currentCursor: cursor,
      appVersion: req.headers.get("x-app-version")?.slice(0,40) || device.appVersion,
      ...(battery.success ? {
        batteryLevel: battery.data.level,
        batteryCharging: battery.data.charging,
        batteryUpdatedAt: new Date(battery.data.updatedAt),
      } : {}),
    },
  });
  return NextResponse.json({
    acknowledged,
    cursor: String(cursor),
    events: updates.map((event) => ({ ...event, sequence: String(event.sequence) })),
    deviceConfiguration: { deviceType: device.deviceType, showBatteryStatus: device.showBatteryStatus },
  });
}
